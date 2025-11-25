import db from '../config/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * User Model
 * Handles user registration, authentication, and profile management
 */
class User {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.phone = data.phone;
    this.dateOfBirth = data.dateOfBirth;
    this.gender = data.gender;
    this.height = data.height; // in cm
    this.weight = data.weight; // in kg
    this.activityLevel = data.activityLevel; // sedentary, light, moderate, active, very_active
    this.dietaryRestrictions = data.dietaryRestrictions || []; // vegetarian, vegan, gluten-free, etc.
    this.healthConditions = data.healthConditions || []; // diabetes, hypertension, etc.
    this.allergies = data.allergies || [];
    this.preferences = data.preferences || {};
    this.location = data.location; // { latitude, longitude, address }
    this.avatar = data.avatar;
    this.preferredLanguage = data.preferredLanguage || 'en';
    this.timezone = data.timezone || 'UTC';
    this.emailVerified = data.emailVerified || false;
    this.phoneVerified = data.phoneVerified || false;
    this.twoFactorEnabled = data.twoFactorEnabled || false;
    this.twoFactorSecret = data.twoFactorSecret;
    this.lastLoginAt = data.lastLoginAt;
    this.loginAttempts = data.loginAttempts || 0;
    this.lockedUntil = data.lockedUntil;
    this.isActive = data.isActive !== false;
    this.isPremium = data.isPremium || false;
    this.premiumExpiresAt = data.premiumExpiresAt;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Create a new user
   */
  static async create(userData) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      
      const user = new User({
        ...userData,
        password: hashedPassword,
        emailVerificationToken,
        emailVerified: false
      });

      const result = await db('users').insert({
        id: user.id,
        email: user.email,
        password: user.password,
        first_name: user.firstName,
        last_name: user.lastName,
        phone: user.phone,
        date_of_birth: user.dateOfBirth,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        activity_level: user.activityLevel,
        dietary_restrictions: JSON.stringify(user.dietaryRestrictions),
        health_conditions: JSON.stringify(user.healthConditions),
        allergies: JSON.stringify(user.allergies),
        preferences: JSON.stringify(user.preferences),
        location: user.location ? JSON.stringify(user.location) : null,
        avatar: user.avatar,
        preferred_language: user.preferredLanguage,
        timezone: user.timezone,
        email_verification_token: emailVerificationToken,
        email_verified: user.emailVerified,
        phone_verified: user.phoneVerified,
        two_factor_enabled: user.twoFactorEnabled,
        last_login_at: user.lastLoginAt,
        login_attempts: user.loginAttempts,
        locked_until: user.lockedUntil,
        is_active: user.isActive,
        is_premium: user.isPremium,
        premium_expires_at: user.premiumExpiresAt,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      }).returning('*');

      logger.info(`User created: ${user.email}`);
      return new User(result[0]);
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    try {
      const userData = await db('users').where({ id, is_active: true }).first();
      if (!userData) return null;

      return new User(userData);
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    try {
      const userData = await db('users').where({ email, is_active: true }).first();
      if (!userData) return null;

      return new User(userData);
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Find user by phone
   */
  static async findByPhone(phone) {
    try {
      const userData = await db('users').where({ phone, is_active: true }).first();
      if (!userData) return null;

      return new User(userData);
    } catch (error) {
      logger.error('Error finding user by phone:', error);
      throw error;
    }
  }

  /**
   * Find user by email verification token
   */
  static async findByVerificationToken(token) {
    try {
      const userData = await db('users')
        .where({ email_verification_token: token, is_active: true })
        .first();
      
      if (!userData) return null;

      return new User(userData);
    } catch (error) {
      logger.error('Error finding user by verification token:', error);
      throw error;
    }
  }

  /**
   * Find user by password reset token
   */
  static async findByResetToken(token) {
    try {
      const userData = await db('users')
        .where({ password_reset_token: token, is_active: true })
        .first();
      
      if (!userData) return null;

      return new User(userData);
    } catch (error) {
      logger.error('Error finding user by reset token:', error);
      throw error;
    }
  }

  /**
   * Get all users with pagination
   */
  static async findAll(options = {}) {
    const { page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;

    try {
      const users = await db('users')
        .where({ is_active: true })
        .select(
          'id',
          'email',
          'first_name',
          'last_name',
          'avatar',
          'is_premium',
          'is_active',
          'last_login_at',
          'created_at',
          'updated_at'
        )
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset);

      const total = await db('users').where({ is_active: true }).count('* as count');

      return {
        users,
        pagination: {
          page,
          limit,
          total: parseInt(total[0].count),
          pages: Math.ceil(total[0].count / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding all users:', error);
      throw error;
    }
  }

  /**
   * Update user
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
      if (cleanData.dietaryRestrictions) {
        cleanData.dietary_restrictions = JSON.stringify(cleanData.dietaryRestrictions);
        delete cleanData.dietaryRestrictions;
      }
      
      if (cleanData.healthConditions) {
        cleanData.health_conditions = JSON.stringify(cleanData.healthConditions);
        delete cleanData.healthConditions;
      }
      
      if (cleanData.allergies) {
        cleanData.allergies = JSON.stringify(cleanData.allergies);
        delete cleanData.allergies;
      }
      
      if (cleanData.preferences) {
        cleanData.preferences = JSON.stringify(cleanData.preferences);
        delete cleanData.preferences;
      }
      
      if (cleanData.location) {
        cleanData.location = JSON.stringify(cleanData.location);
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

      const result = await db('users')
        .where({ id: this.id })
        .update(snakeData)
        .returning('*');

      if (result.length === 0) {
        throw new Error('User not found or update failed');
      }

      Object.assign(this, result[0]);
      logger.info(`User updated: ${this.email}`);
      return this;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async delete() {
    try {
      await db('users').where({ id: this.id }).update({
        is_active: false,
        updated_at: new Date()
      });

      logger.info(`User deleted: ${this.email}`);
      return true;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  async verifyEmail() {
    try {
      await db('users').where({ id: this.id }).update({
        email_verified: true,
        email_verification_token: null,
        updated_at: new Date()
      });

      this.emailVerified = true;
      this.emailVerificationToken = null;
      return this;
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw error;
    }
  }

  /**
   * Verify phone
   */
  async verifyPhone() {
    try {
      await db('users').where({ id: this.id }).update({
        phone_verified: true,
        updated_at: new Date()
      });

      this.phoneVerified = true;
      return this;
    } catch (error) {
      logger.error('Error verifying phone:', error);
      throw error;
    }
  }

  /**
   * Update password
   */
  async updatePassword(newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await db('users').where({ id: this.id }).update({
        password: hashedPassword,
        password_reset_token: null,
        password_reset_expires: null,
        updated_at: new Date()
      });

      this.password = hashedPassword;
      return this;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken() {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour

      await db('users').where({ id: this.id }).update({
        password_reset_token: token,
        password_reset_expires: expires,
        updated_at: new Date()
      });

      this.passwordResetToken = token;
      this.passwordResetExpires = expires;
      return token;
    } catch (error) {
      logger.error('Error generating password reset token:', error);
      throw error;
    }
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(successful = false) {
    try {
      if (successful) {
        await db('users').where({ id: this.id }).update({
          last_login_at: new Date(),
          login_attempts: 0,
          locked_until: null,
          updated_at: new Date()
        });

        this.lastLoginAt = new Date();
        this.loginAttempts = 0;
        this.lockedUntil = null;
      } else {
        const attempts = this.loginAttempts + 1;
        let lockedUntil = null;

        // Lock account after 5 failed attempts
        if (attempts >= 5) {
          lockedUntil = new Date(Date.now() + 900000); // 15 minutes
        }

        await db('users').where({ id: this.id }).update({
          login_attempts: attempts,
          locked_until: lockedUntil,
          updated_at: new Date()
        });

        this.loginAttempts = attempts;
        this.lockedUntil = lockedUntil;
      }

      return this;
    } catch (error) {
      logger.error('Error recording login attempt:', error);
      throw error;
    }
  }

  /**
   * Check if account is locked
   */
  isAccountLocked() {
    return this.lockedUntil && this.lockedUntil > new Date();
  }

  /**
   * Upgrade to premium
   */
  async upgradeToPremium(expiresInDays = 30) {
    try {
      const expiresAt = new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000));

      await db('users').where({ id: this.id }).update({
        is_premium: true,
        premium_expires_at: expiresAt,
        updated_at: new Date()
      });

      this.isPremium = true;
      this.premiumExpiresAt = expiresAt;
      return this;
    } catch (error) {
      logger.error('Error upgrading to premium:', error);
      throw error;
    }
  }

  /**
   * Check if premium is active
   */
  isPremiumActive() {
    return this.isPremium && this.premiumExpiresAt > new Date();
  }

  /**
   * Compare password
   */
  async comparePassword(password) {
    try {
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      logger.error('Error comparing password:', error);
      return false;
    }
  }

  /**
   * Get user's analysis count
   */
  async getAnalysisCount() {
    try {
      const result = await db('food_analyses')
        .where({ user_id: this.id })
        .count('* as count');

      return parseInt(result[0].count);
    } catch (error) {
      logger.error('Error getting analysis count:', error);
      return 0;
    }
  }

  /**
   * Get user's recent analyses
   */
  async getRecentAnalyses(limit = 5) {
    try {
      const analyses = await db('food_analyses')
        .where({ user_id: this.id })
        .select(
          'id',
          'image_url',
          'food_name',
          'freshness_score',
          'created_at'
        )
        .orderBy('created_at', 'desc')
        .limit(limit);

      return analyses;
    } catch (error) {
      logger.error('Error getting recent analyses:', error);
      return [];
    }
  }

  /**
   * Convert to public JSON (remove sensitive data)
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      avatar: this.avatar,
      height: this.height,
      weight: this.weight,
      dietaryRestrictions: this.dietaryRestrictions,
      healthConditions: this.healthConditions,
      allergies: this.allergies,
      location: this.location,
      preferredLanguage: this.preferredLanguage,
      isPremium: this.isPremium,
      premiumExpiresAt: this.premiumExpiresAt,
      emailVerified: this.emailVerified,
      phoneVerified: this.phoneVerified,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt
    };
  }
}

export default User;