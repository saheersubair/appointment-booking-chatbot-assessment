import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function ChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authData, setAuthData] = useState({ email: '', password: '', first_name: '', last_name: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Get tokens on mount if authenticated
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      // Get session token after authentication
      setTimeout(() => {
        getChatbotToken();
      }, 500);
    }
  }, []);

  const getChatbotToken = async () => {
    if (!token) return;
    
    setSessionLoading(true);
    setSessionError('');
    try {
      console.log('Requesting chatbot token from frontend API...');
      const response = await axios.get('/api/chatbot/token', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Received session token from frontend API:', response.data.sessionToken);
      setSessionToken(response.data.sessionToken);
      setSessionLoading(false);
    } catch (error) {
      console.error('Error getting chatbot token from frontend API:', error);
      setSessionLoading(false);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleLogout();
      } else {
        setSessionError(error.response?.data?.error || 'Failed to get session token: ' + error.message);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !sessionToken) {
      console.log('Cannot send message - missing input or session token');
      console.log('Input message:', inputMessage);
      console.log('Session token:', sessionToken);
      return;
    }

    const userMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      console.log('Sending message to frontend API...');
      console.log('Message:', inputMessage);
      console.log('Session token:', sessionToken);
      console.log('Token:', token);
      
      const response = await axios.post('/api/chatbot/message', {
        message: inputMessage,
        sessionToken
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Received response from frontend API:', response.data);
      
      const botMessage = { 
        role: 'assistant', 
        content: response.data.response, 
        timestamp: new Date(),
        action: response.data.action,
        appointment_details: response.data.appointment_details
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error in frontend:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      const errorMessage = { 
        role: 'assistant', 
        content: error.response?.data?.error || `Sorry, I encountered an error. Details: ${error.message}`, 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      let response;
      if (authMode === 'login') {
        response = await axios.post('/api/auth/login', {
          email: authData.email,
          password: authData.password
        });
      } else {
        response = await axios.post('/api/auth/register', {
          email: authData.email,
          password: authData.password,
          first_name: authData.first_name,
          last_name: authData.last_name
        });
      }

      // Store authentication data
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setToken(response.data.token);
      setUser(response.data.user);
      setIsAuthenticated(true);
      setAuthLoading(false);

      // Get chatbot session token after successful authentication
      setTimeout(() => {
        getChatbotToken();
      }, 500);
    } catch (error) {
      console.error('Auth error in frontend:', error);
      setAuthError(error.response?.data?.error || 'Authentication failed: ' + error.message);
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setSessionToken(null);
    setMessages([]);
    setAuthMode('login');
    setAuthData({ email: '', password: '', first_name: '', last_name: '' });
    setSessionError('');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
            {authMode === 'login' ? 'Login to Chatbot' : 'Create Account'}
          </h2>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {authError}
            </div>
          )}
          
          <form onSubmit={handleAuth}>
            {authMode === 'register' && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={authData.first_name}
                    onChange={(e) => setAuthData({...authData, first_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={authData.last_name}
                    onChange={(e) => setAuthData({...authData, last_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </>
            )}
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={authData.email}
                onChange={(e) => setAuthData({...authData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={authData.password}
                onChange={(e) => setAuthData({...authData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {authLoading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError('');
              }}
              className="text-blue-600 hover:underline"
            >
              {authMode === 'login' 
                ? 'Need an account? Register' 
                : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">AI Appointment Scheduler</h1>
              <p className="text-blue-100 text-sm">Hello, {user.first_name}!</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Chat Container */}
          <div className="flex flex-col h-[600px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="flex justify-center items-center h-full">
                  <div className="text-center text-gray-500">
                    <p className="mb-2">Start a conversation to schedule your appointment</p>
                    <p className="text-sm">Try: "I want to schedule an appointment"</p>
                  </div>
                </div>
              )}
              
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.appointment_details && (
                      <div className="mt-2 p-2 bg-green-100 rounded-lg">
                        <p className="text-sm font-semibold text-green-800">Appointment Scheduled!</p>
                        <p className="text-xs text-green-700">
                          {new Date(message.appointment_details.scheduled_datetime).toLocaleString()}
                        </p>
                      </div>
                    )}
                    <p className="text-xs opacity-70 mt-1">
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-2xl">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              {sessionLoading ? (
                <div className="text-center py-4 text-gray-500">
                  Loading chat session...
                </div>
              ) : sessionError ? (
                <div className="text-center py-4">
                  <p className="text-red-600 mb-2">{sessionError}</p>
                  <button 
                    onClick={getChatbotToken}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              ) : !sessionToken ? (
                <div className="text-center py-4 text-gray-500">
                  <p>Session not available. Please refresh or logout and login again.</p>
                  <button 
                    onClick={getChatbotToken}
                    className="mt-2 text-blue-600 hover:underline"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => {
                      console.log('Input changed:', e.target.value);
                      setInputMessage(e.target.value);
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="1"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}