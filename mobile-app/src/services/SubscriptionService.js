// Subscription Service for Mobile App
// Handles subscription management, billing, and feature access

class SubscriptionService {
  constructor() {
    this.baseURL = 'https://api.foodsafe.ai'; // Replace with your API URL
    
    // Subscription tiers with pricing
    this.tiers = {
      free: {
        id: 'free',
        name: 'Free',
        price: '₹0',
        period: 'Forever',
        features: [
          '5 food analyses per day',
          'Basic safety reports',
          'Community access',
          'Educational content (limited)',
          'Ads supported'
        ],
        limits: {
          analysesPerDay: 5,
          videoAnalysisPerDay: 0,
          storageDays: 30,
          familyMembers: 1
        }
      },
      premium: {
        id: 'premium',
        name: 'Food Safety Pro',
        price: '₹299',
        period: 'month',
        originalPrice: '₹399',
        popular: true,
        features: [
          'Unlimited food analyses',
          'Video analysis (20/day)',
          'Voice commands',
          'Offline mode',
          'Advanced nutrition insights',
          'Historical tracking',
          'Priority support',
          'Ad-free experience'
        ],
        limits: {
          analysesPerDay: -1, // unlimited
          videoAnalysisPerDay: 20,
          storageDays: 365,
          familyMembers: 1
        }
      },
      family: {
        id: 'family',
        name: 'Family Protector',
        price: '₹599',
        period: 'month',
        originalPrice: '₹798',
        features: [
          'Everything in Premium',
          'Up to 6 family members',
          'Shared safety history',
          'Family health profiles',
          'Emergency contact alerts',
          'Bulk analysis for meal planning'
        ],
        limits: {
          analysesPerDay: -1, // unlimited
          videoAnalysisPerDay: 50,
          storageDays: 365,
          familyMembers: 6
        }
      },
      restaurant: {
        id: 'restaurant',
        name: 'Restaurant Package',
        price: '₹2,999',
        period: 'month',
        business: true,
        features: [
          'Everything in Family',
          'Staff training modules',
          'Quality assurance protocols',
          'Customer safety reports',
          'Compliance documentation',
          'API access (1000 calls/month)',
          '24/7 phone support'
        ],
        limits: {
          analysesPerDay: -1, // unlimited
          videoAnalysisPerDay: 100,
          storageDays: 730,
          familyMembers: 1,
          apiCallsPerMonth: 1000
        }
      },
      business: {
        id: 'business',
        name: 'Business Package',
        price: '₹9,999',
        period: 'month',
        business: true,
        features: [
          'Everything in Restaurant',
          'Multi-location management (10 locations)',
          'Custom branding',
          'API access (10K calls/month)',
          'Bulk food analysis',
          'Professional audit tools'
        ],
        limits: {
          analysesPerDay: -1, // unlimited
          videoAnalysisPerDay: 500,
          storageDays: 1095,
          familyMembers: 1,
          locations: 10,
          apiCallsPerMonth: 10000
        }
      },
      enterprise: {
        id: 'enterprise',
        name: 'Enterprise Package',
        price: '₹29,999',
        period: 'month',
        business: true,
        premium: true,
        features: [
          'Everything in Business',
          'White-label solution',
          'Custom ML model development',
          'Unlimited API calls',
          'On-premise deployment',
          'SLA guarantees',
          'Custom integrations',
          'Training & certification'
        ],
        limits: {
          analysesPerDay: -1, // unlimited
          videoAnalysisPerDay: -1, // unlimited
          storageDays: 1825,
          familyMembers: 1,
          locations: -1, // unlimited
          apiCallsPerMonth: -1 // unlimited
        }
      }
    };
  }

  /**
   * Get current subscription status
   */
  async getCurrentSubscription() {
    try {
      const token = await this.getStoredToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${this.baseURL}/api/subscriptions/current`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return result.data;
    } catch (error) {
      console.error('Error getting subscription:', error);
      throw error;
    }
  }

  /**
   * Get available subscription tiers
   */
  getAvailableTiers(userType = 'individual') {
    if (userType === 'business') {
      return {
        restaurant: this.tiers.restaurant,
        business: this.tiers.business,
        enterprise: this.tiers.enterprise
      };
    }
    
    return {
      free: this.tiers.free,
      premium: this.tiers.premium,
      family: this.tiers.family
    };
  }

  /**
   * Check if feature is available in current tier
   */
  async hasFeature(feature) {
    try {
      const subscription = await this.getCurrentSubscription();
      return subscription.features?.[feature] === true;
    } catch (error) {
      console.error('Error checking feature:', error);
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsage(resourceType = 'foodAnalysis') {
    try {
      const token = await this.getStoredToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${this.baseURL}/api/subscriptions/usage?resourceType=${resourceType}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return result.data;
    } catch (error) {
      console.error('Error getting usage:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a tier
   */
  async subscribe(tierId, planType = 'monthly') {
    try {
      const token = await this.getStoredToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${this.baseURL}/api/subscriptions/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tier: tierId,
          planType: planType
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      // Handle payment based on your payment provider
      // This is a simplified version - you'd integrate with:
      // - Razorpay for Indian users
      // - Stripe for international users
      // - In-app purchases for App Store/Play Store
      
      await this.processPayment(result.data.subscription, tierId);
      
      return result.data;
    } catch (error) {
      console.error('Error subscribing:', error);
      throw error;
    }
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(newTierId, planType = 'monthly') {
    try {
      const token = await this.getStoredToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${this.baseURL}/api/subscriptions/upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newTier: newTierId,
          planType: planType
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return result.data;
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(reason = null) {
    try {
      const token = await this.getStoredToken();
      if (!token) throw new Error('No authentication token');

      const response = await fetch(`${this.baseURL}/api/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason
        })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return result.data;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Get feature comparison
   */
  getFeatureComparison(tiers = null) {
    const tierKeys = tiers || Object.keys(this.tiers);
    const comparison = {};

    tierKeys.forEach(tierKey => {
      comparison[tierKey] = this.tiers[tierKey];
    });

    return comparison;
  }

  /**
   * Check if user can perform action
   */
  async canPerformAction(action) {
    try {
      const subscription = await this.getCurrentSubscription();
      const tier = subscription.tier;
      const features = subscription.features || {};

      // Define feature requirements
      const featureRequirements = {
        'video_analysis': 'videoAnalysis',
        'voice_commands': 'voiceCommands',
        'offline_mode': 'offlineMode',
        'advanced_nutrition': 'advancedNutrition',
        'historical_tracking': 'historicalTracking',
        'priority_support': 'prioritySupport',
        'ad_free': 'adFree',
        'api_access': 'apiAccess',
        'multi_location': 'multiLocation',
        'white_label': 'whiteLabel'
      };

      const requiredFeature = featureRequirements[action];
      if (requiredFeature && !features[requiredFeature]) {
        return {
          allowed: false,
          reason: `Feature not available in ${tier} plan`,
          upgradeTo: this.getUpgradeSuggestion(requiredFeature)
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking action permission:', error);
      return { allowed: false, reason: 'Unable to verify permissions' };
    }
  }

  /**
   * Get upgrade suggestion for feature
   */
  getUpgradeSuggestion(feature) {
    const suggestions = {
      videoAnalysis: 'premium',
      voiceCommands: 'premium',
      offlineMode: 'premium',
      advancedNutrition: 'premium',
      historicalTracking: 'premium',
      prioritySupport: 'premium',
      adFree: 'premium',
      staffTraining: 'restaurant',
      complianceReports: 'restaurant',
      apiAccess: 'restaurant',
      multiLocation: 'business',
      customBranding: 'business',
      whiteLabel: 'enterprise',
      unlimitedApiCalls: 'enterprise'
    };

    return suggestions[feature] || 'premium';
  }

  /**
   * Process payment (simplified version)
   */
  async processPayment(subscription, tierId) {
    // In a real app, you'd integrate with:
    // 1. In-app purchases for App Store/Play Store
    // 2. Razorpay for web payments in India
    // 3. Stripe for international payments
    
    const tier = this.tiers[tierId];
    
    // For demo purposes, we'll simulate a successful payment
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      amount: tier.price,
      currency: 'INR'
    };
  }

  /**
   * Store authentication token
   */
  async storeToken(token) {
    try {
      // In a real app, you'd use secure storage
      // For React Native: use @react-native-async-storage/async-storage
      // For web: use localStorage or secure cookies
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  /**
   * Get stored authentication token
   */
  async getStoredToken() {
    try {
      // In a real app, you'd use secure storage
      // For React Native: use @react-native-async-storage/async-storage
      // For web: use localStorage or secure cookies
      const token = await AsyncStorage.getItem('auth_token');
      return token;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  /**
   * Format price display
   */
  formatPrice(amount, currency = 'INR') {
    const symbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£'
    };

    const symbol = symbols[currency] || currency;
    return `${symbol}${amount}`;
  }

  /**
   * Calculate savings percentage
   */
  calculateSavings(originalPrice, currentPrice) {
    const savings = originalPrice - currentPrice;
    const percentage = Math.round((savings / originalPrice) * 100);
    return Math.max(0, percentage);
  }
}

// Export singleton instance
export default new SubscriptionService();