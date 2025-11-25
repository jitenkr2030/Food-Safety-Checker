import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Subscription Model
 * Handles subscription tiers, billing, and usage tracking
 */
class Subscription {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.tier = data.tier; // 'free', 'premium', 'family', 'restaurant', 'business', 'enterprise'
    this.status = data.status || 'active'; // 'active', 'canceled', 'expired', 'past_due'
    this.planType = data.planType || 'monthly'; // 'monthly', 'yearly'
    this.amount = data.amount; // subscription amount in paisa
    this.currency = data.currency || 'INR';
    this.startDate = data.startDate || new Date();
    this.endDate = data.endDate;
    this.nextBillingDate = data.nextBillingDate;
    this.trialEndDate = data.trialEndDate;
    this.canceledAt = data.canceledAt;
    this.paymentProvider = data.paymentProvider || 'razorpay'; // 'razorpay', 'stripe', etc.
    this.providerSubscriptionId = data.providerSubscriptionId;
    this.providerCustomerId = data.providerCustomerId;
    this.features = data.features || {};
    this.usageLimits = data.usageLimits || {};
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Create a new subscription
   */
  static async create(subscriptionData) {
    try {
      const subscription = new Subscription(subscriptionData);

      const result = await db('subscriptions').insert({
        id: subscription.id,
        user_id: subscription.userId,
        tier: subscription.tier,
        status: subscription.status,
        plan_type: subscription.planType,
        amount: subscription.amount,
        currency: subscription.currency,
        start_date: subscription.startDate,
        end_date: subscription.endDate,
        next_billing_date: subscription.nextBillingDate,
        trial_end_date: subscription.trialEndDate,
        canceled_at: subscription.canceledAt,
        payment_provider: subscription.paymentProvider,
        provider_subscription_id: subscription.providerSubscriptionId,
        provider_customer_id: subscription.providerCustomerId,
        features: JSON.stringify(subscription.features),
        usage_limits: JSON.stringify(subscription.usageLimits),
        metadata: JSON.stringify(subscription.metadata),
        created_at: subscription.createdAt,
        updated_at: subscription.updatedAt
      }).returning('*');

      logger.info(`Subscription created: ${subscription.tier} for user ${subscription.userId}`);
      return new Subscription(result[0]);
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Find subscription by ID
   */
  static async findById(id) {
    try {
      const subscriptionData = await db('subscriptions').where({ id }).first();
      if (!subscriptionData) return null;

      return new Subscription(subscriptionData);
    } catch (error) {
      logger.error('Error finding subscription by ID:', error);
      throw error;
    }
  }

  /**
   * Find active subscription for user
   */
  static async findActiveByUserId(userId) {
    try {
      const subscriptionData = await db('subscriptions')
        .where({ 
          user_id: userId,
          status: 'active'
        })
        .where('end_date', '>', new Date())
        .orderBy('created_at', 'desc')
        .first();

      if (!subscriptionData) return null;

      return new Subscription(subscriptionData);
    } catch (error) {
      logger.error('Error finding active subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   */
  async update(updateData) {
    try {
      // Remove undefined values
      const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = value;
        }
        return acc;
      }, {});

      // Handle JSON fields
      if (cleanData.features) {
        cleanData.features = JSON.stringify(cleanData.features);
      }
      
      if (cleanData.usageLimits) {
        cleanData.usage_limits = JSON.stringify(cleanData.usageLimits);
      }
      
      if (cleanData.metadata) {
        cleanData.metadata = JSON.stringify(cleanData.metadata);
      }

      // Map camelCase to snake_case
      const snakeData = {};
      Object.entries(cleanData).forEach(([key, value]) => {
        const snakeKey = key
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase();
        snakeData[snakeKey] = value;
      });

      snakeData.updated_at = new Date();

      const result = await db('subscriptions')
        .where({ id: this.id })
        .update(snakeData)
        .returning('*');

      if (result.length === 0) {
        throw new Error('Subscription not found or update failed');
      }

      Object.assign(this, result[0]);
      logger.info(`Subscription updated: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancel(reason = null) {
    try {
      await this.update({
        status: 'canceled',
        canceledAt: new Date(),
        metadata: {
          ...this.metadata,
          cancellationReason: reason
        }
      });

      logger.info(`Subscription canceled: ${this.id}`);
      return this;
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Check if subscription is active and valid
   */
  isActive() {
    return this.status === 'active' && 
           (!this.endDate || this.endDate > new Date());
  }

  /**
   * Check if feature is available in current tier
   */
  hasFeature(feature) {
    return this.features[feature] === true;
  }

  /**
   * Check if usage limit allows usage
   */
  canUseResource(resource, currentUsage = 0) {
    const limit = this.usageLimits[resource];
    
    if (limit === -1 || limit === null) {
      return true; // Unlimited
    }
    
    return currentUsage < limit;
  }

  /**
   * Get remaining usage for resource
   */
  getRemainingUsage(resource, currentUsage = 0) {
    const limit = this.usageLimits[resource];
    
    if (limit === -1 || limit === null) {
      return -1; // Unlimited
    }
    
    return Math.max(0, limit - currentUsage);
  }

  /**
   * Convert to public JSON
   */
  toJSON() {
    return {
      id: this.id,
      tier: this.tier,
      status: this.status,
      planType: this.planType,
      amount: this.amount,
      currency: this.currency,
      startDate: this.startDate,
      endDate: this.endDate,
      nextBillingDate: this.nextBillingDate,
      trialEndDate: this.trialEndDate,
      features: this.features,
      usageLimits: this.usageLimits,
      isActive: this.isActive()
    };
  }
}

export default Subscription;