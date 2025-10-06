from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from typing import Dict, Any, Optional
import json
from datetime import datetime
import logging
from dotenv import load_dotenv
import re

# Load .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chatbot Microservice", version="1.0.0")

# Lazy import to avoid Pydantic conflicts
def get_openai_client():
    try:
        from openai import OpenAI
        return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    except Exception as e:
        logger.warning(f"Could not initialize OpenAI: {e}")
        return None

# Database connection
def get_db_connection():
    import psycopg2
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "chatbot_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
        port=os.getenv("DB_PORT", 5432)
    )

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    user_id: int
    session_token: str

class ChatResponse(BaseModel):
    response: str
    action: Optional[str] = None
    appointment_details: Optional[Dict[str, Any]] = None

# Appointment scheduling logic
class AppointmentScheduler:
    def __init__(self):
        self.db_conn = get_db_connection()
    
    def schedule_appointment(self, user_id: int, date_time: str, duration: int = 30, service_type: str = "Consultation"):
        try:
            # Validate and clean the datetime string
            date_time = date_time.strip()
            
            # Validate datetime format
            try:
                # Try to parse the datetime to ensure it's valid
                datetime.strptime(date_time, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                logger.error(f"Invalid datetime format: {date_time}")
                raise ValueError(f"Invalid datetime format. Expected YYYY-MM-DD HH:MM:SS, got: {date_time}")
            
            with self.db_conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO appointments (user_id, scheduled_datetime, duration_minutes, service_type)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, scheduled_datetime, duration_minutes, service_type
                """, (user_id, date_time, duration, service_type))
                
                result = cursor.fetchone()
                self.db_conn.commit()
                
                return {
                    "id": result[0],
                    "scheduled_datetime": str(result[1]),
                    "duration_minutes": result[2],
                    "service_type": result[3]
                }
        except Exception as e:
            logger.error(f"Error scheduling appointment: {e}")
            self.db_conn.rollback()
            raise e

# Simple conversation memory
class SimpleMemory:
    def __init__(self):
        self.history = []
    
    def add_message(self, role: str, content: str):
        self.history.append({"role": role, "content": content})
        # Keep only last 10 messages
        if len(self.history) > 10:
            self.history = self.history[-10:]
    
    def get_history(self) -> list:
        return self.history

# Chatbot service without LangChain dependency issues
class ChatbotService:
    def __init__(self):
        self.client = get_openai_client()
        self.use_mock = self.client is None
        self.scheduler = AppointmentScheduler()
        self.memories = {}  # session_token -> SimpleMemory
        
        if self.use_mock:
            logger.warning("Using mock responses - OpenAI client not available")
    
    def get_memory(self, session_token: str) -> SimpleMemory:
        if session_token not in self.memories:
            self.memories[session_token] = SimpleMemory()
        return self.memories[session_token]
    
    def process_message(self, message: str, user_id: int, session_token: str) -> ChatResponse:
        try:
            memory = self.get_memory(session_token)
            
            if self.use_mock:
                return self._mock_response(message)
            
            # Build conversation history
            messages = [
                {
                    "role": "system",
                    "content": """You are a helpful assistant for scheduling appointments. 
You can help users schedule appointments and answer questions about existing appointments.

When a user wants to schedule an appointment, extract the following information:
- Date and time (if specified)
- Duration (default to 30 minutes if not specified)
- Service type (default to "Consultation" if not specified)

If the user provides a complete date and time, respond with: "SCHEDULE: [date in YYYY-MM-DD HH:MM:SS format]"
Otherwise, ask clarifying questions."""
                }
            ]
            
            # Add conversation history
            messages.extend(memory.get_history())
            
            # Add current message
            messages.append({"role": "user", "content": message})
            
            # Get response from OpenAI
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            ai_response = response.choices[0].message.content
            
            # Update memory
            memory.add_message("user", message)
            memory.add_message("assistant", ai_response)
            
            # Check if response contains scheduling command
            if ai_response.startswith("SCHEDULE:"):
                appointment_details = self.extract_appointment_details(message, ai_response)
                
                if appointment_details:
                    scheduled_appointment = self.scheduler.schedule_appointment(
                        user_id=user_id,
                        date_time=appointment_details.get("date_time"),
                        duration=appointment_details.get("duration", 30),
                        service_type=appointment_details.get("service_type", "Consultation")
                    )
                    
                    return ChatResponse(
                        response=f"Your appointment has been scheduled for {scheduled_appointment['scheduled_datetime']}.",
                        action="SCHEDULE_APPOINTMENT",
                        appointment_details=scheduled_appointment
                    )
            
            return ChatResponse(response=ai_response)
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            logger.error(f"Error details: {str(e)}", exc_info=True)
            return ChatResponse(response="Sorry, I encountered an error. Please try again.")
    
    def _mock_response(self, message: str) -> ChatResponse:
        if any(word in message.lower() for word in ["appointment", "schedule", "meeting", "book"]):
            return ChatResponse(
                response="I can help you schedule an appointment. Please tell me the date and time you prefer (e.g., 2024-12-25 14:00).",
                action="REQUEST_DETAILS"
            )
        else:
            return ChatResponse(
                response="Hello! I'm here to help you schedule appointments. How can I assist you today?"
            )
    
    def extract_appointment_details(self, user_message: str, ai_response: str) -> Optional[Dict[str, Any]]:
        # Look for SCHEDULE command in AI response
        if ai_response.startswith("SCHEDULE:"):
            date_str = ai_response.replace("SCHEDULE:", "").strip()
            # Extract only the date part using regex
            date_match = re.search(r'(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})', date_str)
            if date_match:
                return {
                    "date_time": date_match.group(1),
                    "duration": 30,
                    "service_type": "Consultation"
                }
        
        # Look for date/time patterns - extract from both messages
        combined_text = user_message + " " + ai_response
        
        # Try full datetime with seconds: YYYY-MM-DD HH:MM:SS
        date_time_pattern = r'(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2})'
        matches = re.findall(date_time_pattern, combined_text)
        
        if matches:
            return {
                "date_time": matches[0],
                "duration": 30,
                "service_type": "Consultation"
            }
        
        # Try datetime without seconds: YYYY-MM-DD HH:MM
        date_time_pattern_no_sec = r'(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})(?!\d)'
        matches = re.findall(date_time_pattern_no_sec, combined_text)
        
        if matches:
            return {
                "date_time": matches[0] + ":00",
                "duration": 30,
                "service_type": "Consultation"
            }
        
        # Try other date formats (date only, no time)
        date_patterns = [
            (r'(\d{4}-\d{2}-\d{2})', '%Y-%m-%d'),
            (r'(\d{2}/\d{2}/\d{4})', '%m/%d/%Y'),
            (r'(\d{2}-\d{2}-\d{4})', '%m-%d-%Y'),
        ]
        
        for pattern, date_format in date_patterns:
            matches = re.findall(pattern, user_message)
            if matches:
                try:
                    # Validate the date
                    datetime.strptime(matches[0], date_format)
                    return {
                        "date_time": f"{matches[0]} 10:00:00",
                        "duration": 30,
                        "service_type": "Consultation"
                    }
                except ValueError:
                    continue
        
        return None

# Initialize chatbot service
chatbot_service = ChatbotService()

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        logger.info(f"Received chat request for user {request.user_id}")
        
        # Validate session exists
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM chat_sessions WHERE session_token = %s AND user_id = %s",
                (request.session_token, request.user_id)
            )
            session = cursor.fetchone()
            
            if not session:
                logger.error(f"Invalid session: {request.session_token} for user {request.user_id}")
                raise HTTPException(status_code=400, detail="Invalid session")
        
        # Process the message
        response = chatbot_service.process_message(
            request.message, 
            request.user_id,
            request.session_token
        )
        
        # Log the interaction
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE chat_sessions 
                SET conversation_log = conversation_log || %s::jsonb
                WHERE session_token = %s
            """, (json.dumps([{
                "role": "user",
                "content": request.message,
                "timestamp": datetime.now().isoformat()
            }, {
                "role": "assistant", 
                "content": response.response,
                "timestamp": datetime.now().isoformat()
            }]), request.session_token))
            conn.commit()
        
        conn.close()
        
        logger.info(f"Response generated successfully: {response.response[:50]}...")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)