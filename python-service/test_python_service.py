import requests

# Test the Python service
try:
    response = requests.get("http://localhost:5000/api/health")
    print("Python service health check:", response.json())
    
    # Test chat endpoint
    chat_response = requests.post("http://localhost:5000/api/chat", 
        json={
            "message": "Hi",
            "user_id": 1,
            "session_token": "test_token"
        },
        headers={"Content-Type": "application/json"}
    )
    print("Chat response:", chat_response.json())
    
except Exception as e:
    print("Error testing Python service:", e)