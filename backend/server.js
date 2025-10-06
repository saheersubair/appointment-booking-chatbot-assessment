const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const Joi = require('joi');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chatbot_db',
  password: process.env.DB_PASSWORD || 'Zaheer123',
  port: process.env.DB_PORT || 5432,
});

// Validation schemas
const userSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required()
});

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'default_secret', (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Body:`, req.body);
  next();
});

// API endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, first_name, last_name } = value;
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
      [email, hashedPassword, first_name, last_name]
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      user: result.rows[0] 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to generate short-lived chatbot access token
app.get('/api/chatbot/token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Generate a short-lived token for chatbot access
    const chatToken = jwt.sign(
      { userId: userId, type: 'chatbot' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '15m' } // 15 minutes expiry
    );

    // Create or update chat session
    const sessionToken = jwt.sign(
      { userId: userId, sessionId: Date.now() },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '24h' }
    );

    console.log('Creating chat session for user:', userId);
    
    // Insert chat session into DB
    await pool.query(
      'INSERT INTO chat_sessions (user_id, session_token, conversation_log, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (session_token) DO UPDATE SET updated_at = NOW()',
      [userId, sessionToken, '[]', new Date(Date.now() + 24 * 60 * 60 * 1000)]
    );

    console.log('Chat session created successfully for user:', userId);
    
    res.json({ 
      chatToken,
      sessionToken
    });
  } catch (error) {
    console.error('Chatbot token error:', error);
    res.status(500).json({ error: 'Failed to generate chatbot token: ' + error.message });
  }
});

// Proxy endpoint to Python microservice
app.post('/api/chatbot/message', authenticateToken, async (req, res) => {
  console.log('=== CHATBOT MESSAGE ENDPOINT CALLED ===');
  console.log('User ID:', req.user.id);
  console.log('Request body:', req.body);
  
  try {
    const { message, sessionToken } = req.body;
    
    if (!message || !sessionToken) {
      console.log('Missing message or session token');
      return res.status(400).json({ error: 'Message and session token required' });
    }

    // Verify session exists
    console.log('Checking session in database...');
    const sessionResult = await pool.query(
      'SELECT * FROM chat_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [sessionToken]
    );
    
    if (sessionResult.rows.length === 0) {
      console.log('Session not found or expired:', sessionToken);
      return res.status(400).json({ error: 'Invalid or expired session' });
    }

    console.log('Session is valid, calling Python service...');
    
    // Call Python microservice
    const axios = require('axios');
    let pythonResponse;
    try {
      console.log('Making request to Python service at http://localhost:5000/api/chat');
      pythonResponse = await axios.post('http://localhost:5000/api/chat', {
        message,
        user_id: req.user.id,
        session_token: sessionToken
      }, {
        timeout: 30000  // 30 second timeout
      });
      console.log('Python service responded successfully:', pythonResponse.data);
    } catch (pythonError) {
      console.error('Python service error:', pythonError.message);
      console.error('Python service response status:', pythonError.response?.status);
      console.error('Python service response data:', pythonError.response?.data);
      console.error('Python service response headers:', pythonError.response?.headers);
      return res.status(500).json({ 
        error: 'Python service error: ' + pythonError.message,
        details: process.env.NODE_ENV === 'development' ? pythonError.response?.data : undefined
      });
    }

    // Update conversation log
    const session = sessionResult.rows[0];
    const conversationLog = session.conversation_log || [];
    const updatedLog = [
      ...conversationLog,
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: pythonResponse.data.response, timestamp: new Date() }
    ];

    await pool.query(
      'UPDATE chat_sessions SET conversation_log = $1 WHERE session_token = $2',
      [JSON.stringify(updatedLog), sessionToken]
    );

    console.log('Message processed successfully');
    res.json(pythonResponse.data);
  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test database connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Database connection test failed:', err.message);
    } else {
      console.log('Database connected successfully');
    }
  });
});