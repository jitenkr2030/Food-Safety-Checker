import express from 'express';
import multer from 'multer';
import Subscription from '../models/Subscription.js';
import UsageTracking from '../models/UsageTracking.js';
import User from '../models/User.js';
import SubscriptionService from '../services/SubscriptionService.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Get all available subscription tiers
router.get('/tiers', (req, res) => {
  try {
    const tiers = SubscriptionService.getAllTiers();
    
    const formattedTiers = tiers.map(tier => ({
      tier: tier.tier,
      name: tier.name,
      price: {
        monthly: {
          amount: tier.price.monthly,
          display: SubscriptionService.formatPrice(tier.price.monthly, req.query.currency || 'INR')
        },
        yearly: {
          amount: tier.price.yearly,
          display: SubscriptionService.formatPrice(tier.price.yearly, req.query.currency || 'INR')
        }
      },
      features: tier.features,
      limits: tier.limits
    }));

    res.json({
      success: true,
      data: formattedTiers
    });
  } catch (error) {
    logger.error('Error getting subscription tiers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription tiers'
    });
  }
});

// Get user's current subscription
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const subscription = await Subscription.findActiveByUserId(req.user.id);
    
    if (!subscription) {
      return res.json({
        success: true,
        data: {
          subscription: null,
          tier: 'free',
          isActive: false,
          features: SubscriptionService.getTierConfig('free').features,
          limits: SubscriptionService.getTierConfig('free').limits
        }
      });
    }

    res.json({
      success: true,
      data: {
        subscription: subscription.toJSON(),
        tier: subscription.tier,
        isActive: subscription.isActive(),
        features: subscription.features,
        limits: subscription.usageLimits
      });
  } catch (error) {
    logger.error('Error getting current subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current subscription'
    });
  }
});

// Get user's usage statistics
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const { resourceType = 'foodAnalysis', days = 30 } = req.query;
    const userId = req.user.id;

    // Get today's usage
    const todayUsage = await UsageTracking.getTodayUsage(userId, resourceType);
    
    // Get usage for the period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const endDateStr = new Date().toISOString().split('T')[0];
    const periodUsage = await UsageTracking.getUsageRange(userId, resourceType, startDateStr, endDateStr);

    // Get subscription limits
    const subscription = await Subscription.findActiveByUserId(userId);
    const currentTier = subscription ? subscription.tier : 'free';
    const limits = SubscriptionService.getTierConfig(currentTier);

    // Calculate remaining usage
    const currentUsage = todayUsage ? todayUsage.usageCount : 0;
    const dailyLimit = limits.limits[`${resourceType}PerDay`] || 0;
    const remaining = SubscriptionService.hasFeature(currentTier, resourceType) 
      ? SubscriptionService.getLimit(currentTier, `${resourceType}PerDay`) === -1 
        ? -1 
        : Math.max(0, dailyLimit - currentUsage)
      : 0;

    res.json({
      success: true,
      data: {
        currentTier,
        resourceType,
        todayUsage: currentUsage,
        dailyLimit: dailyLimit === -1 ? 'unlimited' : dailyLimit,
        remainingUsage: remaining,
        periodUsage: periodUsage.map(u => u.toJSON()),
        canUse: remaining > 0 || remaining === -1
      }
    });
  } catch (error) {
    logger.error('Error getting usage statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics'
    });
  }
});

// Create new subscription
router.post('/subscribe', authenticateToken, [
  body('tier').isIn(['premium', 'family', 'restaurant', 'business', 'enterprise']).withMessage('Invalid subscription tier'),
  body('planType').optional().isIn(['monthly', 'yearly']).withMessage('Invalid plan type'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { tier, planType = 'monthly', paymentMethodId } = req.body;
    const userId = req.user.id;

    // Get tier configuration
    const tierConfig = SubscriptionService.getTierConfig(tier);
    if (!tierConfig) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription tier'
      });
    }

    // Check if user already has active subscription
    const existingSubscription = await Subscription.findActiveByUserId(userId);
    if (existingSubscription && existingSubscription.tier !== 'free') {
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription'
      });
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = new Date();
    
    if (planType === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const nextBillingDate = new Date(endDate);

    // Create subscription
    const subscription = await Subscription.create({
      userId,
      tier,
      status: 'active',
      planType,
      amount: tierConfig.price[planType],
      currency: 'INR',
      startDate,
      endDate,
      nextBillingDate,
      features: tierConfig.features,
      usageLimits: tierConfig.limits,
      metadata: {
        signupSource: 'web',
        paymentMethodId
      }
    });

    // Update user premium status
    await User.findById(userId).then(user => {
      if (user) {
        user.update({
          isPremium: true,
          premiumExpiresAt: endDate
        });
      }
    });

    logger.info(`Subscription created: ${tier} for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription: subscription.toJSON(),
        billing: {
          amount: SubscriptionService.formatPrice(tierConfig.price[planType], 'INR'),
          nextBillingDate: nextBillingDate.toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription'
    });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, [
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.user.id;

    const subscription = await Subscription.findActiveByUserId(userId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    await subscription.cancel(reason);

    // Update user premium status
    await User.findById(userId).then(user => {
      if (user) {
        user.update({
          isPremium: false,
          premiumExpiresAt: subscription.endDate
        });
      }
    });

    logger.info(`Subscription canceled: ${subscription.id} for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription canceled successfully',
      data: {
        subscriptionId: subscription.id,
        willExpireAt: subscription.endDate
      }
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
});

// Upgrade subscription
router.post('/upgrade', authenticateToken, [
  body('newTier').isIn(['premium', 'family', 'restaurant', 'business', 'enterprise']).withMessage('Invalid subscription tier'),
  body('planType').optional().isIn(['monthly', 'yearly']).withMessage('Invalid plan type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { newTier, planType = 'monthly' } = req.body;
    const userId = req.user.id;

    const currentSubscription = await Subscription.findActiveByUserId(userId);
    const currentTier = currentSubscription ? currentSubscription.tier : 'free';

    // Validate upgrade
    const validation = SubscriptionService.validateUpgrade(currentTier, newTier);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason
      });
    }

    // Calculate prorated amount if upgrading mid-cycle
    let proratedAmount = 0;
    if (currentSubscription && currentSubscription.endDate > new Date()) {
      const remainingDays = Math.ceil((currentSubscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
      proratedAmount = SubscriptionService.calculateUpgradeAmount(currentTier, newTier, remainingDays);
    }

    // Cancel current subscription
    if (currentSubscription) {
      await currentSubscription.cancel('upgraded');
    }

    // Create new subscription
    const tierConfig = SubscriptionService.getTierConfig(newTier);
    const startDate = new Date();
    const endDate = new Date();
    
    if (planType === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const newSubscription = await Subscription.create({
      userId,
      tier: newTier,
      status: 'active',
      planType,
      amount: tierConfig.price[planType],
      currency: 'INR',
      startDate,
      endDate,
      nextBillingDate: endDate,
      features: tierConfig.features,
      usageLimits: tierConfig.limits,
      metadata: {
        upgradeFrom: currentTier,
        proratedAmount
      }
    });

    logger.info(`Subscription upgraded: ${currentTier} -> ${newTier} for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      data: {
        subscription: newSubscription.toJSON(),
        billing: {
          proratedAmount: SubscriptionService.formatPrice(proratedAmount, 'INR'),
          regularAmount: SubscriptionService.formatPrice(tierConfig.price[planType], 'INR'),
          nextBillingDate: endDate.toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription'
    });
  }
});

// Get feature comparison
router.get('/compare', (req, res) => {
  try {
    const { tiers } = req.query;
    const tierList = tiers ? tiers.split(',') : null;
    
    const comparison = SubscriptionService.getFeatureComparison(tierList);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    logger.error('Error getting feature comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feature comparison'
    });
  }
});

// Admin: Get subscription statistics
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (implement admin check based on your requirements)
    // For now, we'll allow any authenticated user
    
    const { tier, period = '30' } = req.query;
    
    let query = db('subscriptions').select(
      'tier',
      'status',
      db.raw('COUNT(*) as count'),
      db.raw('SUM(amount) as total_revenue')
    );
    
    if (tier) {
      query = query.where('tier', tier);
    }

    if (period !== 'all') {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));
      query = query.where('created_at', '>=', startDate);
    }

    const stats = await query
      .groupBy('tier', 'status')
      .orderBy('tier');

    // Get total user count
    const totalUsers = await db('users').where({ is_active: true }).count('* as count');

    res.json({
      success: true,
      data: {
        subscriptionStats: stats,
        totalUsers: parseInt(totalUsers[0].count)
      }
    });
  } catch (error) {
    logger.error('Error getting subscription stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription statistics'
    });
  }
});

export default router;