import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import hpp from 'hpp';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import middleware
import { errorHandler, notFound } from './middleware/error.js';
import { logger } from './utils/logger.js';
import { connectDB } from './config/database.js';
import { redisClient } from './config/redis.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import analysisRoutes from './routes/analysis.js';
import subscriptionRoutes from './routes/subscriptions.js';
import videoAnalysisRoutes from './routes/videoAnalysis.js';
import partnershipRoutes from './routes/partnershipRevenue.js';
import foodRoutes from './routes/foods.js';
import mlRoutes from './routes/ml.js';
import adminRoutes from './routes/admin.js';

// Import services
import { initializeMLServices } from './services/mlService.js';
import { startWorker } from './services/workerService.js';

// Load environment variables
dotenv.config();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database connection
await connectDB();
logger.info('✅ Database connected successfully');

// Initialize Redis connection
await redisClient.connect();
logger.info('✅ Redis connected successfully');

// Initialize ML Services
await initializeMLServices();
logger.info('✅ ML Services initialized');

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.foodsafe.ai"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500
});

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:19006',
      'exp://localhost:19006',
      'https://your-app.expo.dev',
      'https://foodsafe.ai'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-api-key',
    'x-client-version'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining']
};

// Global Middleware
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use((req, res, next) => {
  req.body = xss(req.body);
  req.query = xss(req.query);
  req.params = xss(req.params);
  next();
});

// Prevent parameter pollution
app.use(hpp());

// Apply rate limiting
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use(speedLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'FoodSafe AI API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Documentation
app.use('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../docs/api-docs.html'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/analysis/video', videoAnalysisRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/partnerships', partnershipRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/admin', adminRoutes);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve static assets for production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../mobile-app/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../mobile-app/dist/index.html'));
  });
}

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close server
  server.close(() => {
    logger.info('HTTP server closed.');
  });
  
  // Close database connection
  logger.info('Closing database connections...');
  
  // Close Redis connection
  redisClient.quit().then(() => {
    logger.info('Redis connection closed.');
    process.exit(0);
  }).catch((err) => {
    logger.error('Error closing Redis connection:', err);
    process.exit(1);
  });
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start background worker
startWorker().then(() => {
  logger.info('✅ Background worker started');
}).catch((error) => {
  logger.error('❌ Failed to start background worker:', error);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`
🚀 FoodSafe AI Backend Server
🌍 Environment: ${process.env.NODE_ENV}
🔗 Port: ${PORT}
📊 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Not configured'}
🔄 Redis: ${process.env.REDIS_URL || 'Not configured'}
🧠 ML Services: Initialized
📱 API Docs: http://localhost:${PORT}/api-docs
    `);
});

// Export app for testing
export default app;