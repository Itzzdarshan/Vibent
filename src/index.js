/**
 * VIBENT - Entertainment Chatbot
 * Main Entry Point
 * 
 * Initializes Express server, middleware, OAuth flows, and bot engine
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { errorHandler } = require('./utils/error-handler');
const { oauthMiddleware } = require('./middleware/auth-middleware');
const { conversationEngine } = require('./core/conversation-engine');
const { sessionManager } = require('./core/session-manager');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security Middleware
app.use(helmet());

// CORS Configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body Parsing Middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Session Management
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 1800000,
    sameSite: 'lax'
  }
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests, please try again later'
});
app.use('/api/', limiter);

// Logger Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// OAuth Routes
app.use('/oauth', require('./routes/oauth-routes'));

// Bot API Routes
app.post('/api/chat', oauthMiddleware, (req, res) => {
  const { message, userId, sessionId } = req.body;
  
  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and userId are required' });
  }
  
  conversationEngine.processMessage(message, userId, sessionId)
    .then(response => res.json(response))
    .catch(err => {
      logger.error(`Chat processing error: ${err.message}`);
      res.status(500).json({ error: 'Failed to process message' });
    });
});

app.post('/api/conversation/start', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  
  const sessionId = sessionManager.createSession(userId);
  res.json({ sessionId, message: 'Conversation started' });
});

app.post('/api/conversation/end', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  
  sessionManager.endSession(sessionId);
  res.json({ message: 'Conversation ended' });
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = sessionManager.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  errorHandler(err, req, res);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`🎬 VIBENT Chatbot running on port ${PORT} in ${NODE_ENV} mode`);
  logger.info(`Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
