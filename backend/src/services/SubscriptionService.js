/**
 * Subscription Service
 * Defines subscription tiers, features, and pricing
 */

class SubscriptionService {
  constructor() {
    this.tiers = {
      free: {
        name: 'Free',
        price: {
          monthly: 0,
          yearly: 0
        },
        features: {
          foodAnalysis: true,
          basicReports: true,
          communityAccess: true,
          educationalContent: false,
          videoAnalysis: false,
          voiceCommands: false,
          offlineMode: false,
          advancedNutrition: false,
          historicalTracking: false,
          prioritySupport: false,
          adFree: false,
          staffTraining: false,
          complianceReports: false,
          apiAccess: false,
          multiLocation: false,
          customBranding: false,
          whiteLabel: false,
          unlimitedApiCalls: false
        },
        limits: {
          foodAnalysisPerDay: 5,
          videoAnalysisPerDay: 0,
          apiCallsPerMonth: 0,
          familyMembers: 1,
          locations: 1,
          storageDays: 30
        }
      },
      premium: {
        name: 'Food Safety Pro',
        price: {
          monthly: 29900, // ₹299 in paisa
          yearly: 28700   // ₹287 (20% discount)
        },
        features: {
          foodAnalysis: true,
          basicReports: true,
          communityAccess: true,
          educationalContent: true,
          videoAnalysis: true,
          voiceCommands: true,
          offlineMode: true,
          advancedNutrition: true,
          historicalTracking: true,
          prioritySupport: true,
          adFree: true,
          staffTraining: false,
          complianceReports: false,
          apiAccess: false,
          multiLocation: false,
          customBranding: false,
          whiteLabel: false,
          unlimitedApiCalls: false
        },
        limits: {
          foodAnalysisPerDay: -1, // unlimited
          videoAnalysisPerDay: 20,
          apiCallsPerMonth: 0,
          familyMembers: 1,
          locations: 1,
          storageDays: 365
        }
      },
      family: {
        name: 'Family Protector',
        price: {
          monthly: 59900, // ₹599 in paisa
          yearly: 57480   // ₹479 (20% discount)
        },
        features: {
          foodAnalysis: true,
          basicReports: true,
          communityAccess: true,
          educationalContent: true,
          videoAnalysis: true,
          voiceCommands: true,
          offlineMode: true,
          advancedNutrition: true,
          historicalTracking: true,
          prioritySupport: true,
          adFree: true,
          staffTraining: false,
          complianceReports: false,
          apiAccess: false,
          multiLocation: false,
          customBranding: false,
          whiteLabel: false,
          unlimitedApiCalls: false
        },
        limits: {
          foodAnalysisPerDay: -1, // unlimited
          videoAnalysisPerDay: 50,
          apiCallsPerMonth: 0,
          familyMembers: 6,
          locations: 1,
          storageDays: 365
        }
      },
      restaurant: {
        name: 'Restaurant Package',
        price: {
          monthly: 299900, // ₹2,999 in paisa
          yearly: 287880   // ₹2,399 (20% discount)
        },
        features: {
          foodAnalysis: true,
          basicReports: true,
          communityAccess: true,
          educationalContent: true,
          videoAnalysis: true,
          voiceCommands: true,
          offlineMode: true,
          advancedNutrition: true,
          historicalTracking: true,
          prioritySupport: true,
          adFree: true,
          staffTraining: true,
          complianceReports: true,
          apiAccess: true,
          multiLocation: false,
          customBranding: false,
          whiteLabel: false,
          unlimitedApiCalls: false
        },
        limits: {
          foodAnalysisPerDay: -1, // unlimited
          videoAnalysisPerDay: 100,
          apiCallsPerMonth: 1000,
          familyMembers: 1,
          locations: 1,
          storageDays: 730
        }
      },
      business: {
        name: 'Business Package',
        price: {
          monthly: 999900, // ₹9,999 in paisa
          yearly: 959904   // ₹8,000 (20% discount)
        },
        features: {
          foodAnalysis: true,
          basicReports: true,
          communityAccess: true,
          educationalContent: true,
          videoAnalysis: true,
          voiceCommands: true,
          offlineMode: true,
          advancedNutrition: true,
          historicalTracking: true,
          prioritySupport: true,
          adFree: true,
          staffTraining: true,
          complianceReports: true,
          apiAccess: true,
          multiLocation: true,
          customBranding: true,
          whiteLabel: false,
          unlimitedApiCalls: false
        },
        limits: {
          foodAnalysisPerDay: -1, // unlimited
          videoAnalysisPerDay: 500,
          apiCallsPerMonth: 10000,
          familyMembers: 1,
          locations: 10,
          storageDays: 1095
        }
      },
      enterprise: {
        name: 'Enterprise Package',
        price: {
          monthly: 2999900, // ₹29,999 in paisa
          yearly: 2879904   // ₹24,000 (20% discount)
        },
        features: {
          foodAnalysis: true,
          basicReports: true,
          communityAccess: true,
          educationalContent: true,
          videoAnalysis: true,
          voiceCommands: true,
          offlineMode: true,
          advancedNutrition: true,
          historicalTracking: true,
          prioritySupport: true,
          adFree: true,
          staffTraining: true,
          complianceReports: true,
          apiAccess: true,
          multiLocation: true,
          customBranding: true,
          whiteLabel: true,
          unlimitedApiCalls: true
        },
        limits: {
          foodAnalysisPerDay: -1, // unlimited
          videoAnalysisPerDay: -1, // unlimited
          apiCallsPerMonth: -1, // unlimited
          familyMembers: 1,
          locations: -1, // unlimited
          storageDays: 1825
        }
      }
    };

    this.currencyRates = {
      INR: 1,
      USD: 82.5, // Approximate conversion rate
      EUR: 90.2,
      GBP: 103.5
    };
  }

  /**
   * Get tier configuration
   */
  getTierConfig(tier) {
    return this.tiers[tier];
  }

  /**
   * Get all available tiers
   */
  getAllTiers() {
    return Object.keys(this.tiers).map(tier => ({
      tier,
      ...this.tiers[tier]
    }));
  }

  /**
   * Check if feature is available in tier
   */
  hasFeature(tier, feature) {
    const config = this.getTierConfig(tier);
    return config ? config.features[feature] === true : false;
  }

  /**
   * Get usage limit for tier
   */
  getLimit(tier, limitType) {
    const config = this.getTierConfig(tier);
    return config ? config.limits[limitType] : 0;
  }

  /**
   * Get price for tier in specific currency
   */
  getPrice(tier, currency = 'INR', planType = 'monthly') {
    const config = this.getTierConfig(tier);
    if (!config) return 0;

    const basePrice = config.price[planType] || 0;
    const rate = this.currencyRates[currency] || 1;
    
    return Math.round(basePrice * rate);
  }

  /**
   * Format price for display
   */
  formatPrice(amount, currency = 'INR') {
    const symbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£'
    };

    const symbol = symbols[currency] || currency;
    const formatted = (amount / 100).toFixed(2);
    
    return `${symbol}${formatted}`;
  }

  /**
   * Get feature comparison matrix
   */
  getFeatureComparison(tiers = null) {
    const targetTiers = tiers || Object.keys(this.tiers);
    const allFeatures = new Set();
    
    // Collect all features
    targetTiers.forEach(tier => {
      const config = this.getTierConfig(tier);
      if (config) {
        Object.keys(config.features).forEach(feature => allFeatures.add(feature));
      }
    });

    const comparison = {};
    
    targetTiers.forEach(tier => {
      const config = this.getTierConfig(tier);
      if (config) {
        comparison[tier] = {
          ...config
        };
      }
    });

    return comparison;
  }

  /**
   * Get upgrade recommendations for user
   */
  getUpgradeRecommendations(currentTier, usageStats = {}) {
    const recommendations = [];
    const currentConfig = this.getTierConfig(currentTier);
    
    if (!currentConfig) return recommendations;

    // Check usage limits
    Object.entries(usageStats).forEach(([resource, usage]) => {
      const currentLimit = currentConfig.limits[resource];
      
      if (currentLimit !== -1 && usage > currentLimit * 0.8) {
        // User is using 80%+ of their limit
        
        // Find next tier with higher limit
        const higherTiers = Object.keys(this.tiers)
          .filter(tier => tier !== currentTier)
          .map(tier => ({
            tier,
            config: this.tiers[tier]
          }))
          .filter(({ config }) => 
            config.limits[resource] === -1 || 
            config.limits[resource] > currentLimit
          )
          .sort((a, b) => a.config.price.monthly - b.config.price.monthly);

        if (higherTiers.length > 0) {
          recommendations.push({
            reason: `${resource} usage approaching limit`,
            current: usage,
            limit: currentLimit,
            recommendedTier: higherTiers[0].tier,
            recommendedConfig: higherTiers[0].config
          });
        }
      }
    });

    return recommendations;
  }

  /**
   * Validate subscription upgrade
   */
  validateUpgrade(fromTier, toTier) {
    const fromConfig = this.getTierConfig(fromTier);
    const toConfig = this.getTierConfig(toTier);

    if (!fromConfig || !toConfig) {
      return { valid: false, reason: 'Invalid tier' };
    }

    if (fromTier === toTier) {
      return { valid: false, reason: 'Already on this tier' };
    }

    // Check if it's actually an upgrade (higher price)
    if (toConfig.price.monthly <= fromConfig.price.monthly) {
      return { valid: false, reason: 'Can only upgrade to higher tier' };
    }

    return { valid: true };
  }

  /**
   * Calculate prorated amount for upgrade
   */
  calculateUpgradeAmount(fromTier, toTier, remainingDays) {
    const fromConfig = this.getTierConfig(fromTier);
    const toConfig = this.getTierConfig(toTier);

    if (!fromConfig || !toConfig) {
      return 0;
    }

    const monthlyDiff = toConfig.price.monthly - fromConfig.price.monthly;
    const dailyRate = monthlyDiff / 30;
    const proratedAmount = Math.round(dailyRate * remainingDays);

    return Math.max(0, proratedAmount);
  }
}

export default new SubscriptionService();