import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import FoodAnalysis from '../models/FoodAnalysis.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateSubscription, validateUsageLimit } from '../middleware/subscription.js';
import logger from '../utils/logger.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm)'));
    }
  }
});

/**
 * @route   POST /api/analysis/video/analyze
 * @desc    Perform real-time video analysis for food safety
 * @access  Private - Premium/Restaurant/Business/Enterprise only
 */
router.post('/analyze', 
  authenticateToken,
  validateSubscription(['videoAnalysis']),
  validateUsageLimit('videoAnalysis'),
  upload.single('video'),
  [
    body('foodName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Food name must be between 1 and 100 characters'),
    body('analysisDuration')
      .optional()
      .isInt({ min: 5, max: 300 })
      .withMessage('Analysis duration must be between 5 and 300 seconds'),
    body('frameRate')
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage('Frame rate must be between 1 and 30 fps'),
    body('realTimeAnalysis')
      .optional()
      .isBoolean()
      .withMessage('Real-time analysis flag must be boolean')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No video file provided'
        });
      }

      const { 
        foodName = 'Unknown Food',
        analysisDuration = 30,
        frameRate = 5,
        realTimeAnalysis = false,
        userPreferences = {},
        notes,
        tags
      } = req.body;

      logger.info(`Starting video analysis for user ${req.user.id}`);

      // Get user's subscription tier
      const userTier = req.userTier || 'free';
      const subscription = req.subscription;

      // Validate video analysis limits based on tier
      const dailyLimit = subscription ? subscription.usageLimits['videoAnalysisPerDay'] : 0;
      if (dailyLimit !== -1 && dailyLimit < 1) {
        return res.status(403).json({
          success: false,
          message: 'Video analysis not available in your current plan',
          upgradeAvailable: true
        });
      }

      // Prepare video analysis options
      const analysisOptions = {
        foodName,
        analysisType: 'video',
        userTier,
        subscription: subscription ? subscription.toJSON() : null,
        videoAnalysis: {
          duration: parseInt(analysisDuration),
          frameRate: parseInt(frameRate),
          realTime: realTimeAnalysis === 'true',
          videoPath: req.file.path,
          videoSize: req.file.size,
          videoMimeType: req.file.mimetype
        },
        userPreferences: typeof userPreferences === 'string' 
          ? JSON.parse(userPreferences) 
          : userPreferences,
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          platform: req.get('platform') || 'web'
        }
      };

      // Add notes and tags if provided
      if (notes) analysisOptions.notes = notes;
      if (tags) analysisOptions.tags = typeof tags === 'string' ? tags.split(',') : tags;

      // Initialize video analysis with ML service
      try {
        // In a real implementation, you would:
        // 1. Extract frames from video
        // 2. Run ML analysis on each frame
        // 3. Track changes over time
        // 4. Provide real-time feedback

        const analysis = await FoodAnalysis.performVideoAnalysis(
          req.user.id,
          req.file.path,
          analysisOptions
        );

        // Clean up uploaded file after processing
        setTimeout(async () => {
          try {
            await fs.remove(req.file.path);
          } catch (error) {
            logger.warn('Failed to clean up uploaded video file:', error);
          }
        }, 10000); // Longer delay for video files

        logger.info(`Video analysis completed for user ${req.user.id}, analysis ${analysis.id}`);

        // Return comprehensive video analysis results
        res.status(201).json({
          success: true,
          message: 'Video food safety analysis completed successfully',
          data: {
            analysisId: analysis.id,
            videoAnalysis: {
              totalFrames: analysis.videoAnalysis?.totalFrames || 0,
              analyzedDuration: analysis.videoAnalysis?.analyzedDuration || 0,
              frameAnalysis: analysis.videoAnalysis?.frameAnalysis || [],
              realTimeFeedback: analysis.videoAnalysis?.realTimeFeedback || [],
              safetyProgression: analysis.videoAnalysis?.safetyProgression || []
            },
            results: analysis.toJSON(true),
            safetyBreakdown: analysis.getSafetyBreakdown(),
            safetyReport: analysis.generateSafetyReport(),
            recommendations: analysis.getRecommendations(),
            processingTime: analysis.analysisDuration,
            videoInsights: {
              cookingProcess: analysis.videoAnalysis?.cookingProcess || 'Unknown',
              temperatureChanges: analysis.videoAnalysis?.temperatureChanges || [],
              contaminationRisk: analysis.videoAnalysis?.contaminationRisk || 'Unknown',
              qualityScore: analysis.videoAnalysis?.qualityScore || 0
            }
          }
        });

      } catch (mlError) {
        logger.error('Video ML analysis failed:', mlError);
        
        // Clean up file on ML error
        if (req.file) {
          try {
            await fs.remove(req.file.path);
          } catch (cleanupError) {
            logger.warn('Failed to cleanup video file:', cleanupError);
          }
        }

        throw mlError;
      }

    } catch (error) {
      logger.error('Video analysis error:', error);

      // Clean up uploaded file in case of error
      if (req.file) {
        try {
          await fs.remove(req.file.path);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup uploaded video file:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Video food safety analysis failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/analysis/video/realtime
 * @desc    Start real-time video analysis session
 * @access  Private - Premium/Restaurant/Business/Enterprise only
 */
router.post('/realtime',
  authenticateToken,
  validateSubscription(['videoAnalysis']),
  upload.single('video'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No video file provided'
        });
      }

      const { sessionId, foodName = 'Unknown Food' } = req.body;

      // Generate session ID if not provided
      const realtimeSessionId = sessionId || `realtime_${Date.now()}_${req.user.id}`;

      logger.info(`Starting real-time video analysis session: ${realtimeSessionId}`);

      // Initialize real-time analysis session
      const session = await FoodAnalysis.startRealtimeSession(
        req.user.id,
        realtimeSessionId,
        req.file.path,
        { foodName }
      );

      res.json({
        success: true,
        message: 'Real-time analysis session started',
        data: {
          sessionId: realtimeSessionId,
          status: 'active',
          videoUploaded: true,
          websocketUrl: `/ws/realtime/${realtimeSessionId}` // WebSocket endpoint for real-time updates
        }
      });

    } catch (error) {
      logger.error('Real-time session error:', error);
      
      // Clean up file on error
      if (req.file) {
        try {
          await fs.remove(req.file.path);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup video file:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to start real-time analysis session',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analysis/video/usage
 * @desc    Get user's video analysis usage statistics
 * @access  Private
 */
router.get('/usage',
  authenticateToken,
  async (req, res) => {
    try {
      const { days = 30 } = req.query;
      const userId = req.user.id;

      // Get subscription info
      const subscription = await Subscription.findActiveByUserId(userId);
      const tier = subscription ? subscription.tier : 'free';
      const limits = subscription ? subscription.usageLimits : SubscriptionService.getTierConfig('free').limits;

      // Get today's usage
      const todayUsage = await UsageTracking.getTodayUsage(userId, 'videoAnalysis');
      
      // Get usage for the period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const endDateStr = new Date().toISOString().split('T')[0];
      const periodUsage = await UsageTracking.getUsageRange(userId, 'videoAnalysis', startDateStr, endDateStr);

      const currentUsage = todayUsage ? todayUsage.usageCount : 0;
      const dailyLimit = limits['videoAnalysisPerDay'] || 0;
      const remaining = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - currentUsage);

      res.json({
        success: true,
        data: {
          tier,
          currentTier,
          videoAnalysis: {
            todayUsage: currentUsage,
            dailyLimit: dailyLimit === -1 ? 'unlimited' : dailyLimit,
            remainingUsage: remaining,
            periodUsage: periodUsage.length,
            canAnalyze: remaining > 0 || remaining === -1
          },
          limits: {
            videoAnalysisPerDay: dailyLimit === -1 ? 'unlimited' : dailyLimit
          },
          features: subscription ? subscription.features : SubscriptionService.getTierConfig('free').features
        }
      });

    } catch (error) {
      logger.error('Error getting video analysis usage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get video analysis usage'
      });
    }
  }
);

export default router;