import { Request, Response, NextFunction } from 'express';
import Subscription from '../models/Subscription.js';
import UsageTracking from '../models/UsageTracking.js';
import SubscriptionService from '../services/SubscriptionService.js';

/**
 * Subscription validation middleware
 */
export const validateSubscription = (requiredFeatures = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const subscription = await Subscription.findActiveByUserId(userId);
      const tier = subscription ? subscription.tier : 'free';

      // Check if all required features are available
      for (const feature of requiredFeatures) {
        if (!SubscriptionService.hasFeature(tier, feature)) {
          return res.status(403).json({
            success: false,
            message: `Feature '${feature}' is not available in your current plan`,
            requiredTier: getRequiredTierForFeature(feature),
            upgradeAvailable: true
          });
        }
      }

      // Attach subscription info to request for further use
      req.subscription = subscription;
      req.userTier = tier;

      next();
    } catch (error) {
      console.error('Subscription validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate subscription'
      });
    }
  };
};

/**
 * Usage limit validation middleware
 */
export const validateUsageLimit = (resourceType, customLimit = null) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      // Get current subscription
      const subscription = await Subscription.findActiveByUserId(userId);
      const tier = subscription ? subscription.tier : 'free';

      // Get today's usage
      const todayUsage = await UsageTracking.getTodayUsage(userId, resourceType);
      const currentUsage = todayUsage ? todayUsage.usageCount : 0;

      // Get limit for this tier
      const limit = customLimit || SubscriptionService.getLimit(tier, `${resourceType}PerDay`);

      // Check if user can use this resource
      if (!SubscriptionService.canUseResource(resourceType, currentUsage)) {
        const remainingTime = getResetTime(resourceType);
        
        return res.status(429).json({
          success: false,
          message: `Daily limit reached for ${resourceType}`,
          currentUsage,
          limit: limit === -1 ? 'unlimited' : limit,
          remainingTime,
          upgradeAvailable: tier !== 'enterprise',
          suggestedTier: getUpgradeSuggestion(resourceType, currentUsage, tier)
        });
      }

      // Record usage
      await UsageTracking.recordUsage(userId, resourceType, 1, {
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      next();
    } catch (error) {
      console.error('Usage limit validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate usage limits'
      });
    }
  };
};

/**
 * Get required tier for a feature
 */
function getRequiredTierForFeature(feature) {
  const featureRequirements = {
    // B2C Features
    videoAnalysis: 'premium',
    voiceCommands: 'premium',
    offlineMode: 'premium',
    advancedNutrition: 'premium',
    historicalTracking: 'premium',
    prioritySupport: 'premium',
    adFree: 'premium',
    
    // B2B Features
    staffTraining: 'restaurant',
    complianceReports: 'restaurant',
    apiAccess: 'restaurant',
    multiLocation: 'business',
    customBranding: 'business',
    whiteLabel: 'enterprise',
    unlimitedApiCalls: 'enterprise'
  };

  return featureRequirements[feature] || 'premium';
}

/**
 * Get upgrade suggestion based on resource usage
 */
function getUpgradeSuggestion(resourceType, currentUsage, currentTier) {
  const limit = SubscriptionService.getLimit(currentTier, `${resourceType}PerDay`);
  
  if (limit === -1) {
    return null; // Already unlimited
  }

  // Find next tier with higher limit
  const allTiers = Object.keys(SubscriptionService.tiers);
  const currentIndex = allTiers.indexOf(currentTier);
  
  for (let i = currentIndex + 1; i < allTiers.length; i++) {
    const tier = allTiers[i];
    const tierConfig = SubscriptionService.getTierConfig(tier);
    const tierLimit = tierConfig.limits[`${resourceType}PerDay`];
    
    if (tierLimit === -1 || tierLimit > limit) {
      return tier;
    }
  }

  return null;
}

/**
 * Get reset time for resource limit
 */
function getResetTime(resourceType) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  return {
    resetAt: tomorrow.toISOString(),
    timeUntilReset: tomorrow.getTime() - now.getTime()
  };
}

/**
 * Rate limiting middleware for API endpoints
 */
export const rateLimitByTier = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();

  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const subscription = await Subscription.findActiveByUserId(userId);
      const tier = subscription ? subscription.tier : 'free';
      
      // Adjust limits based on tier
      let tierMaxRequests = maxRequests;
      
      switch (tier) {
        case 'premium':
          tierMaxRequests = maxRequests * 5;
          break;
        case 'family':
          tierMaxRequests = maxRequests * 10;
          break;
        case 'restaurant':
          tierMaxRequests = maxRequests * 20;
          break;
        case 'business':
          tierMaxRequests = maxRequests * 50;
          break;
        case 'enterprise':
          tierMaxRequests = maxRequests * 100;
          break;
        default:
          tierMaxRequests = Math.floor(maxRequests * 0.5);
      }

      const key = `${userId}:${Math.floor(Date.now() / windowMs)}`;
      const current = requests.get(key) || 0;

      if (current >= tierMaxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded',
          tier,
          maxRequests: tierMaxRequests,
          windowMs: windowMs / 1000
        });
      }

      requests.set(key, current + 1);
      
      // Clean old entries
      const now = Date.now();
      for (const [k] of requests) {
        const timestamp = parseInt(k.split(':')[1]) * windowMs;
        if (now - timestamp > windowMs * 2) {
          requests.delete(k);
        }
      }

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Continue on error
    }
  };
};

/**
 * Middleware to check API access for B2B tiers
 */
export const requireApiAccess = () => {
  return validateSubscription(['apiAccess']);
};

/**
 * Middleware to check multi-location access
 */
export const requireMultiLocation = () => {
  return validateSubscription(['multiLocation']);
};

/**
 * Middleware to check white-label access
 */
export const requireWhiteLabel = () => {
  return validateSubscription(['whiteLabel']);
};