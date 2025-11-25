import crypto from 'crypto';
import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Payment Service
 * Handles subscription billing with multiple providers (Razorpay, Stripe)
 */
class PaymentService {
  constructor() {
    this.providers = {
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
      },
      stripe: {
        keyId: process.env.STRIPE_KEY_ID,
        keySecret: process.env.STRIPE_KEY_SECRET,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
      }
    };
    
    this.defaultProvider = 'razorpay'; // Default for Indian market
  }

  /**
   * Create subscription with payment provider
   */
  async createSubscription(subscriptionData) {
    const provider = this.providers[subscriptionData.paymentProvider] ? subscriptionData.paymentProvider : this.defaultProvider;
    
    switch (provider) {
      case 'razorpay':
        return this.createRazorpaySubscription(subscriptionData);
      case 'stripe':
        return this.createStripeSubscription(subscriptionData);
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  /**
   * Create Razorpay subscription
   */
  async createRazorpaySubscription(data) {
    try {
      const { amount, currency = 'INR', customerId, planId, notes = {} } = data;
      
      // Create Razorpay order
      const orderData = {
        amount: amount, // Amount in paisa
        currency,
        receipt: `receipt_${Date.now()}`,
        notes: {
          ...notes,
          subscriptionTier: data.tier,
          userId: data.userId
        }
      };

      const auth = Buffer.from(`${this.providers.razorpay.keyId}:${this.providers.razorpay.keySecret}`).toString('base64');
      
      const response = await axios.post('https://api.razorpay.com/v1/orders', orderData, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`Razorpay subscription created for user ${data.userId}`);

      return {
        provider: 'razorpay',
        orderId: response.data.id,
        amount: response.data.amount,
        currency: response.data.currency,
        keyId: this.providers.razorpay.keyId,
        customerId: response.data.notes.customer_id || customerId,
        subscriptionId: response.data.id
      };
    } catch (error) {
      logger.error('Razorpay subscription creation failed:', error);
      throw new Error(`Payment provider error: ${error.response?.data?.error?.description || error.message}`);
    }
  }

  /**
   * Create Stripe subscription
   */
  async createStripeSubscription(data) {
    try {
      // This would require Stripe SDK integration
      // For now, return a mock response structure
      logger.info(`Stripe subscription would be created for user ${data.userId}`);
      
      return {
        provider: 'stripe',
        subscriptionId: `sub_${Date.now()}`,
        clientSecret: `pi_${Date.now()}_secret_${crypto.randomBytes(16).toString('hex')}`,
        amount: data.amount,
        currency: data.currency || 'usd'
      };
    } catch (error) {
      logger.error('Stripe subscription creation failed:', error);
      throw new Error(`Payment provider error: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, provider = 'razorpay') {
    switch (provider) {
      case 'razorpay':
        return this.verifyRazorpayWebhook(payload, signature);
      case 'stripe':
        return this.verifyStripeWebhook(payload, signature);
      default:
        return false;
    }
  }

  /**
   * Verify Razorpay webhook signature
   */
  verifyRazorpayWebhook(payload, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.providers.razorpay.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Razorpay webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripeWebhook(payload, signature) {
    try {
      // Stripe webhook verification would be implemented here
      // For now, return true for demo purposes
      return true;
    } catch (error) {
      logger.error('Stripe webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhook(event) {
    const { provider, type, data } = event;

    logger.info(`Processing ${provider} webhook event: ${type}`);

    switch (type) {
      case 'payment.captured':
        return this.handlePaymentCaptured(data, provider);
      case 'subscription.charged':
        return this.handleSubscriptionCharged(data, provider);
      case 'subscription.cancelled':
        return this.handleSubscriptionCancelled(data, provider);
      case 'invoice.payment_failed':
        return this.handlePaymentFailed(data, provider);
      default:
        logger.info(`Unhandled webhook event: ${type}`);
        return { handled: false };
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentCaptured(data, provider) {
    try {
      const { order_id, amount, notes } = data;
      
      // Update subscription status based on payment
      logger.info(`Payment captured: ${order_id}, amount: ${amount}`);
      
      // This would integrate with your subscription management
      // to activate the subscription after successful payment
      
      return { handled: true, action: 'subscription_activated' };
    } catch (error) {
      logger.error('Error handling payment captured:', error);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Handle subscription charge
   */
  async handleSubscriptionCharged(data, provider) {
    try {
      const { subscription_id, amount } = data;
      
      logger.info(`Subscription charged: ${subscription_id}, amount: ${amount}`);
      
      // Handle recurring billing
      return { handled: true, action: 'subscription_billed' };
    } catch (error) {
      logger.error('Error handling subscription charge:', error);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancelled(data, provider) {
    try {
      const { subscription_id } = data;
      
      logger.info(`Subscription cancelled: ${subscription_id}`);
      
      // Update subscription status to cancelled
      return { handled: true, action: 'subscription_cancelled' };
    } catch (error) {
      logger.error('Error handling subscription cancellation:', error);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailed(data, provider) {
    try {
      const { invoice_id, amount_due } = data;
      
      logger.warn(`Payment failed: ${invoice_id}, amount due: ${amount_due}`);
      
      // Handle failed payment - could pause subscription or send notification
      return { handled: true, action: 'payment_failed' };
    } catch (error) {
      logger.error('Error handling payment failure:', error);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Get payment provider customer
   */
  async getCustomer(customerId, provider = 'razorpay') {
    try {
      switch (provider) {
        case 'razorpay':
          return this.getRazorpayCustomer(customerId);
        case 'stripe':
          return this.getStripeCustomer(customerId);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Error getting customer ${customerId}:`, error);
      throw error;
    }
  }

  /**
   * Get Razorpay customer
   */
  async getRazorpayCustomer(customerId) {
    try {
      const auth = Buffer.from(`${this.providers.razorpay.keyId}:${this.providers.razorpay.keySecret}`).toString('base64');
      
      const response = await axios.get(`https://api.razorpay.com/v1/customers/${customerId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting Razorpay customer:', error);
      throw error;
    }
  }

  /**
   * Get Stripe customer
   */
  async getStripeCustomer(customerId) {
    try {
      // Stripe customer retrieval would be implemented here
      logger.info(`Would get Stripe customer: ${customerId}`);
      return { id: customerId, email: 'demo@example.com' };
    } catch (error) {
      logger.error('Error getting Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create customer in payment provider
   */
  async createCustomer(customerData) {
    const provider = customerData.paymentProvider || this.defaultProvider;
    
    switch (provider) {
      case 'razorpay':
        return this.createRazorpayCustomer(customerData);
      case 'stripe':
        return this.createStripeCustomer(customerData);
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  /**
   * Create Razorpay customer
   */
  async createRazorpayCustomer(data) {
    try {
      const { name, email, phone } = data;
      
      const customerData = {
        name,
        email,
        contact: phone
      };

      const auth = Buffer.from(`${this.providers.razorpay.keyId}:${this.providers.razorpay.keySecret}`).toString('base64');
      
      const response = await axios.post('https://api.razorpay.com/v1/customers', customerData, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`Razorpay customer created: ${response.data.id}`);

      return {
        provider: 'razorpay',
        customerId: response.data.id,
        name: response.data.name,
        email: response.data.email,
        phone: response.data.contact
      };
    } catch (error) {
      logger.error('Error creating Razorpay customer:', error);
      throw new Error(`Customer creation failed: ${error.response?.data?.error?.description || error.message}`);
    }
  }

  /**
   * Create Stripe customer
   */
  async createStripeCustomer(data) {
    try {
      // Stripe customer creation would be implemented here
      logger.info(`Would create Stripe customer for ${data.email}`);
      
      return {
        provider: 'stripe',
        customerId: `cus_${Date.now()}`,
        name: data.name,
        email: data.email
      };
    } catch (error) {
      logger.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Format amount for display
   */
  formatAmount(amount, currency = 'INR') {
    const symbols = {
      INR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£'
    };

    const symbol = symbols[currency] || currency;
    return `${symbol}${(amount / 100).toFixed(2)}`;
  }

  /**
   * Validate payment configuration
   */
  validateConfiguration() {
    const errors = [];
    
    // Check Razorpay configuration
    if (!this.providers.razorpay.keyId || !this.providers.razorpay.keySecret) {
      errors.push('Razorpay configuration missing');
    }
    
    // Check Stripe configuration
    if (!this.providers.stripe.keyId || !this.providers.stripe.keySecret) {
      errors.push('Stripe configuration missing');
    }
    
    if (errors.length > 0) {
      logger.warn('Payment service configuration issues:', errors);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default new PaymentService();