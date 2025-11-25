import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import FoodAnalysis from '../models/FoodAnalysis.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUsageLimit, rateLimitByTier } from '../middleware/subscription.js';
import logger from '../utils/logger.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'food-images');
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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * @route   POST /api/analysis/analyze
 * @desc    Perform comprehensive ML-powered food safety analysis
 * @access  Private
 */
router.post('/analyze', 
  authenticateToken,
  rateLimitByTier(),
  validateUsageLimit('foodAnalysis'),
  upload.single('image'),
  [
    body('foodName')
      .optional()
      .isLength({ min: 1, max: 100 })
      .withMessage('Food name must be between 1 and 100 characters'),
    body('analysisType')
      .optional()
      .isIn(['basic', 'comprehensive', 'premium'])
      .withMessage('Analysis type must be basic, comprehensive, or premium'),
    body('userPreferences')
      .optional()
      .isObject()
      .withMessage('User preferences must be an object')
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
          message: 'No image file provided'
        });
      }

      const { 
        foodName = 'Unknown Food',
        analysisType = 'comprehensive',
        userPreferences = {},
        notes,
        tags
      } = req.body;

      logger.info(`Starting ML food analysis for user ${req.user.id}`);

      // Get user's subscription tier
      const userTier = req.userTier || 'free';
      
      // Adjust analysis type based on subscription tier
      let finalAnalysisType = analysisType;
      if (analysisType === 'premium' && !['premium', 'family', 'restaurant', 'business', 'enterprise'].includes(userTier)) {
        finalAnalysisType = 'comprehensive';
      }

      // Prepare options for ML analysis
      const analysisOptions = {
        foodName,
        analysisType: finalAnalysisType,
        userTier,
        subscription: req.subscription ? req.subscription.toJSON() : null,
        userPreferences: typeof userPreferences === 'string' 
          ? JSON.parse(userPreferences) 
          : userPreferences,
        thumbnail: req.file.path,
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          platform: req.get('platform') || 'web'
        }
      };

      // Add notes and tags if provided
      if (notes) analysisOptions.notes = notes;
      if (tags) analysisOptions.tags = typeof tags === 'string' ? tags.split(',') : tags;

      // Perform ML-powered analysis
      const analysis = await FoodAnalysis.performAnalysis(
        req.user.id,
        req.file.path,
        analysisOptions
      );

      // Clean up uploaded file after processing
      setTimeout(async () => {
        try {
          await fs.remove(req.file.path);
        } catch (error) {
          logger.warn('Failed to clean up uploaded file:', error);
        }
      }, 5000);

      logger.info(`ML food analysis completed for user ${req.user.id}, analysis ${analysis.id}`);

      res.status(201).json({
        success: true,
        message: 'Food safety analysis completed successfully',
        data: {
          analysisId: analysis.id,
          results: analysis.toJSON(true),
          safetyBreakdown: analysis.getSafetyBreakdown(),
          safetyReport: analysis.generateSafetyReport(),
          processingTime: analysis.analysisDuration
        }
      });

    } catch (error) {
      logger.error('Food analysis error:', error);

      // Clean up uploaded file in case of error
      if (req.file) {
        try {
          await fs.remove(req.file.path);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup uploaded file:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Food safety analysis failed',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analysis/:id
 * @desc    Get specific food analysis with enhanced ML details
 * @access  Private
 */
router.get('/:id', 
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const analysis = await FoodAnalysis.findById(id, req.user.id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      // Get enhanced details with ML data
      const enhancedAnalysis = await analysis.getEnhancedDetails();

      res.json({
        success: true,
        data: {
          analysis: enhancedAnalysis.toJSON(true),
          safetyBreakdown: enhancedAnalysis.getSafetyBreakdown(),
          safetyReport: enhancedAnalysis.generateSafetyReport()
        }
      });

    } catch (error) {
      logger.error('Error getting analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analysis',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analysis
 * @desc    Get user's food analyses with filtering and pagination
 * @access  Private
 */
router.get('/', 
  authenticateToken,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
        analysisType,
        processingStatus,
        minFreshnessScore,
        maxFreshnessScore,
        startDate,
        endDate,
        search
      } = req.query;

      // Build filters object
      const filters = {};
      if (analysisType) filters.analysisType = analysisType;
      if (processingStatus) filters.processingStatus = processingStatus;
      if (minFreshnessScore) filters.minFreshnessScore = parseFloat(minFreshnessScore);
      if (maxFreshnessScore) filters.maxFreshnessScore = parseFloat(maxFreshnessScore);
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await FoodAnalysis.findByUser(req.user.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        filters
      });

      // Add safety breakdown for each analysis
      const analysesWithBreakdown = result.analyses.map(analysis => ({
        ...analysis.toJSON(),
        safetyBreakdown: analysis.getSafetyBreakdown()
      }));

      res.json({
        success: true,
        data: {
          analyses: analysesWithBreakdown,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Error getting user analyses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analyses',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analysis/stats
 * @desc    Get user's food analysis statistics
 * @access  Private
 */
router.get('/stats/overview', 
  authenticateToken,
  async (req, res) => {
    try {
      const { dateRange = 30 } = req.query;
      
      const stats = await FoodAnalysis.getUserStats(req.user.id, parseInt(dateRange));

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting analysis stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analysis/trending
 * @desc    Get trending food analyses from community
 * @access  Private
 */
router.get('/trending', 
  authenticateToken,
  async (req, res) => {
    try {
      const { limit = 10, timeRange = 24 } = req.query;
      
      const trending = await FoodAnalysis.getTrending(
        parseInt(limit), 
        parseInt(timeRange)
      );

      const trendingWithReports = trending.map(analysis => ({
        ...analysis.toJSON(),
        safetyReport: analysis.generateSafetyReport()
      }));

      res.json({
        success: true,
        data: trendingWithReports
      });

    } catch (error) {
      logger.error('Error getting trending analyses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve trending analyses',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/analysis/:id
 * @desc    Update analysis (notes, tags, etc.)
 * @access  Private
 */
router.put('/:id',
  authenticateToken,
  [
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('isShared')
      .optional()
      .isBoolean()
      .withMessage('isShared must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      
      const analysis = await FoodAnalysis.findById(id, req.user.id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      // Update allowed fields
      const { notes, tags, isShared } = req.body;
      const updateData = {};
      
      if (notes !== undefined) updateData.notes = notes;
      if (tags !== undefined) updateData.tags = tags;
      if (isShared !== undefined) updateData.isShared = isShared;

      await analysis.update(updateData);

      const updatedAnalysis = await analysis.getEnhancedDetails();

      res.json({
        success: true,
        message: 'Analysis updated successfully',
        data: {
          analysis: updatedAnalysis.toJSON(true)
        }
      });

    } catch (error) {
      logger.error('Error updating analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update analysis',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/analysis/:id
 * @desc    Soft delete analysis
 * @access  Private
 */
router.delete('/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const analysis = await FoodAnalysis.findById(id, req.user.id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      await analysis.delete();

      res.json({
        success: true,
        message: 'Analysis deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete analysis',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/analysis/:id/share
 * @desc    Share analysis with another user
 * @access  Private
 */
router.post('/:id/share',
  authenticateToken,
  [
    body('userId')
      .notEmpty()
      .withMessage('User ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { userId: targetUserId } = req.body;
      
      const analysis = await FoodAnalysis.findById(id, req.user.id);
      
      if (!analysis) {
        return res.status(404).json({
          success: false,
          message: 'Analysis not found'
        });
      }

      await analysis.shareWith(targetUserId);

      res.json({
        success: true,
        message: 'Analysis shared successfully'
      });

    } catch (error) {
      logger.error('Error sharing analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to share analysis',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/analysis/shared
 * @desc    Get analyses shared with user
 * @access  Private
 */
router.get('/shared',
  authenticateToken,
  async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const result = await FoodAnalysis.getSharedWithUser(req.user.id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      const sharedWithReports = result.analyses.map(analysis => ({
        ...analysis.toJSON(),
        safetyReport: analysis.generateSafetyReport()
      }));

      res.json({
        success: true,
        data: {
          analyses: sharedWithReports,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Error getting shared analyses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve shared analyses',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/analysis/bulk-delete
 * @desc    Bulk delete analyses
 * @access  Private
 */
router.post('/bulk-delete',
  authenticateToken,
  [
    body('analysisIds')
      .isArray({ min: 1 })
      .withMessage('Analysis IDs array is required'),
    body('analysisIds.*')
      .isUUID()
      .withMessage('Each analysis ID must be a valid UUID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { analysisIds } = req.body;
      
      const deletedCount = await FoodAnalysis.bulkDelete(analysisIds, req.user.id);

      res.json({
        success: true,
        message: `Successfully deleted ${deletedCount} analyses`,
        data: { deletedCount }
      });

    } catch (error) {
      logger.error('Error bulk deleting analyses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete analyses',
        error: error.message
      });
    }
  }
);

// Health check endpoint for ML service
router.get('/health/ml-status',
  authenticateToken,
  async (req, res) => {
    try {
      // This would check the actual ML service status
      const mlService = await FoodAnalysis.initializeMLService();
      const isMLReady = mlService && typeof mlService.analyzeFood === 'function';

      res.json({
        success: true,
        data: {
          mlServiceAvailable: isMLReady,
          serviceType: isMLReady ? 'ml_service' : 'mock_service',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error checking ML service status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check ML service status',
        error: error.message
      });
    }
  }
);

export default router;