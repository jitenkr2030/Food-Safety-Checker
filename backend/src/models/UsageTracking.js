import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Usage Tracking Model
 * Tracks user usage against subscription limits
 */
class UsageTracking {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.date = data.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.resourceType = data.resourceType; // 'food_analysis', 'video_analysis', 'api_calls', etc.
    this.usageCount = data.usageCount || 0;
    this.lastUsedAt = data.lastUsedAt || new Date();
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Record usage
   */
  static async recordUsage(userId, resourceType, count = 1, metadata = {}) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Try to update existing record
      const updated = await db('usage_tracking')
        .where({
          user_id: userId,
          date: today,
          resource_type: resourceType
        })
        .update({
          usage_count: db.raw('usage_count + ?', [count]),
          last_used_at: new Date(),
          metadata: JSON.stringify(metadata),
          updated_at: new Date()
        })
        .returning('*');

      if (updated.length > 0) {
        return new UsageTracking(updated[0]);
      }

      // Create new record
      const usageTracking = new UsageTracking({
        userId,
        date: today,
        resourceType,
        usageCount: count,
        metadata
      });

      const result = await db('usage_tracking').insert({
        id: usageTracking.id,
        user_id: usageTracking.userId,
        date: usageTracking.date,
        resource_type: usageTracking.resourceType,
        usage_count: usageTracking.usageCount,
        last_used_at: usageTracking.lastUsedAt,
        metadata: JSON.stringify(usageTracking.metadata),
        created_at: usageTracking.createdAt,
        updated_at: usageTracking.updatedAt
      }).returning('*');

      logger.info(`Usage recorded: ${userId} ${resourceType} ${count}`);
      return new UsageTracking(result[0]);
    } catch (error) {
      logger.error('Error recording usage:', error);
      throw error;
    }
  }

  /**
   * Get today's usage for user and resource
   */
  static async getTodayUsage(userId, resourceType) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const result = await db('usage_tracking')
        .where({
          user_id: userId,
          date: today,
          resource_type: resourceType
        })
        .first();

      return result ? new UsageTracking(result) : null;
    } catch (error) {
      logger.error('Error getting today usage:', error);
      throw error;
    }
  }

  /**
   * Get usage for date range
   */
  static async getUsageRange(userId, resourceType, startDate, endDate) {
    try {
      const results = await db('usage_tracking')
        .where({
          user_id: userId,
          resource_type: resourceType
        })
        .whereBetween('date', [startDate, endDate])
        .orderBy('date', 'desc');

      return results.map(result => new UsageTracking(result));
    } catch (error) {
      logger.error('Error getting usage range:', error);
      throw error;
    }
  }

  /**
   * Get total usage for period
   */
  static async getTotalUsage(userId, resourceType, startDate, endDate) {
    try {
      const result = await db('usage_tracking')
        .where({
          user_id: userId,
          resource_type: resourceType
        })
        .whereBetween('date', [startDate, endDate])
        .sum('usage_count as total');

      return parseInt(result[0].total) || 0;
    } catch (error) {
      logger.error('Error getting total usage:', error);
      throw error;
    }
  }

  /**
   * Get monthly usage summary
   */
  static async getMonthlyUsageSummary(userId, year, month) {
    try {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const results = await db('usage_tracking')
        .where({
          user_id: userId
        })
        .whereBetween('date', [startDate, endDate])
        .select(
          'resource_type',
          db.raw('SUM(usage_count) as total_usage'),
          db.raw('COUNT(DISTINCT date) as active_days')
        )
        .groupBy('resource_type');

      return results;
    } catch (error) {
      logger.error('Error getting monthly usage summary:', error);
      throw error;
    }
  }

  /**
   * Reset usage (for admin or testing)
   */
  static async resetUsage(userId, resourceType, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      await db('usage_tracking')
        .where({
          user_id: userId,
          date: targetDate,
          resource_type: resourceType
        })
        .update({
          usage_count: 0,
          updated_at: new Date()
        });

      logger.info(`Usage reset: ${userId} ${resourceType} ${targetDate}`);
      return true;
    } catch (error) {
      logger.error('Error resetting usage:', error);
      throw error;
    }
  }

  /**
   * Clean up old usage records
   */
  static async cleanupOldRecords(keepDays = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      const cutoff = cutoffDate.toISOString().split('T')[0];

      const deleted = await db('usage_tracking')
        .where('date', '<', cutoff)
        .del();

      logger.info(`Cleaned up ${deleted} old usage records`);
      return deleted;
    } catch (error) {
      logger.error('Error cleaning up old usage records:', error);
      throw error;
    }
  }

  /**
   * Convert to public JSON
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date,
      resourceType: this.resourceType,
      usageCount: this.usageCount,
      lastUsedAt: this.lastUsedAt
    };
  }
}

export default UsageTracking;