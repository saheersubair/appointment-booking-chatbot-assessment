# AI Appointment Scheduler Chatbot

A comprehensive chatbot application built with modern web technologies and LangChain integration for appointment scheduling. The system features a React/Next.js frontend, Node.js/Express backend, and Python microservice with LangChain integration.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Features

- **Real-time Chat Interface**: Interactive chatbot for appointment scheduling
- **User Authentication**: Secure login and registration system
- **Appointment Scheduling**: Natural language processing for scheduling appointments
- **Session Management**: Secure chat session handling
- **Conversation History**: Persistent conversation logs
- **Responsive Design**: Mobile-friendly UI
- **API Rate Limiting**: Protection against abuse
- **Security Measures**: JWT authentication, input validation, CORS

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Python         │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│  Microservice   │
│                 │    │                 │    │  (LangChain)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                            │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
```

- **Frontend**: Next.js application with React components
- **Backend**: Node.js/Express API with authentication and session management
- **Python Service**: LangChain-based chatbot microservice
- **Database**: PostgreSQL for user data, appointments, and chat logs

## Prerequisites

- Node.js (v16 or higher)
- Python (v3.8 or higher)
- PostgreSQL
- OpenAI API Key (optional, for full functionality)
- Docker (optional, for containerized deployment)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chatbot-app
```

### 2. Setup Project Structure

Create the following directory structure:

```
chatbot-app/
├── frontend/
├── backend/
├── python-service/
├── postgres/
│   └── init.sql
└── docker-compose.yml
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Install Python Dependencies

```bash
cd python-service
pip install -r requirements.txt
```

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
```

## Configuration

### 1. Database Setup

Create the PostgreSQL database schema:

```bash
# If using Docker
docker run --name postgres-chatbot -e POSTGRES_DB=chatbot_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15

# Or connect to your local PostgreSQL and run the schema
psql -h localhost -U postgres -d chatbot_db -f postgres/init.sql
```

### 2. Environment Variables

Create the following `.env` files:

#### Backend (.env)
```env
DB_USER=postgres
DB_HOST=localhost
DB_NAME=chatbot_db
DB_PASSWORD=password
DB_PORT=5432
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:3000
```

#### Python Service (.env)
```env
DB_HOST=localhost
DB_NAME=chatbot_db
DB_USER=postgres
DB_PASSWORD=password
DB_PORT=5432
OPENAI_API_KEY=your-openai-api-key-here
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

## Running the Application

### Option 1: Manual Setup (Recommended for Development)

1. **Start PostgreSQL** (if using Docker):
   ```bash
   docker run --name postgres-chatbot -e POSTGRES_DB=chatbot_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
   ```

2. **Start Python Service**:
   ```bash
   cd python-service
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 5000
   ```

3. **Start Backend**:
   ```bash
   cd backend
   npm start
   ```

4. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

### Option 2: Docker Compose (Production-like Setup)

1. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY=your-openai-api-key-here
   ```

2. Start all services:
   ```bash
   docker-compose up --build
   ```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Python Service**: http://localhost:5000
- **Database**: localhost:5432

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Chatbot Endpoints

- `GET /api/chatbot/token` - Get chat session token (requires auth)
- `POST /api/chatbot/message` - Send chat message (requires auth)

### Health Check

- `GET /api/health` - Backend health check
- `GET /api/health` - Python service health check (port 5000)

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Appointments Table
```sql
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    scheduled_datetime TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
    service_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Chat Sessions Table
```sql
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    conversation_log JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);
```

## Environment Variables

### Backend (.env)
- `DB_USER`: Database username (default: postgres)
- `DB_HOST`: Database host (default: localhost)
- `DB_NAME`: Database name (default: chatbot_db)
- `DB_PASSWORD`: Database password
- `DB_PORT`: Database port (default: 5432)
- `JWT_SECRET`: JWT secret key
- `FRONTEND_URL`: Frontend URL for CORS

### Python Service (.env)
- `DB_HOST`: Database host
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_PORT`: Database port
- `OPENAI_API_KEY`: OpenAI API key (optional)

### Frontend (.env.local)
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Verify PostgreSQL is running
   - Check credentials in environment files
   - Ensure database name exists

2. **Python Service Not Responding**:
   - Check if Python service is running on port 5432
   - Verify environment variables are set correctly
   - Check logs for specific error messages

3. **Authentication Failing**:
   - Verify JWT secret is consistent across services
   - Check if user exists in the database
   - Ensure session tokens are being generated properly

4. **Frontend API Routes Not Found**:
   - Verify API route files exist in `pages/api/`
   - Check environment variables are set correctly
   - Ensure frontend is restarted after creating new API routes

### Debugging Steps

1. Check all service logs for error messages
2. Verify network connectivity between services
3. Test each service independently
4. Check browser developer tools for frontend issues

## Development

### Adding New Features

1. **Frontend**: Add components in the `frontend/pages/` directory
2. **Backend**: Add API endpoints in `backend/server.js`
3. **Python Service**: Add new endpoints in `python-service/main.py`

### Testing

1. **Unit Tests**: Add tests in respective service directories
2. **Integration Tests**: Test API endpoints directly
3. **End-to-End Tests**: Use tools like Cypress for UI testing

### Code Style

- Follow JavaScript/React best practices for frontend
- Use consistent naming conventions
- Document API endpoints and database schemas
- Include error handling for all user inputs

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: This is a sample application. For production use, ensure proper security measures, environment-specific configurations, and thorough testing.