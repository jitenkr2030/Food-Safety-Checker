import redis from 'redis';
import logger from '../utils/logger.js';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  
  // Connection timeout
  connectTimeout: 60000,
  
  // Commands timeout
  commandTimeout: 5000,
  
  // Enable offline queue
  enableOfflineQueue: true,
  
  // Lazy connect
  lazyConnect: true,
  
  // Key prefix for namespacing
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'foodsafe:',
  
  // TTL for different cache types
  ttl: {
    session: 86400, // 24 hours
    analysis: 3600, // 1 hour
    user: 1800, // 30 minutes
    food: 86400, // 24 hours
    ml: 7200, // 2 hours
    rateLimit: 900, // 15 minutes
    temporary: 300 // 5 minutes
  }
};

// Create Redis client
const redisClient = redis.createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
    connectTimeout: redisConfig.connectTimeout,
    commandTimeout: redisConfig.commandTimeout
  },
  password: redisConfig.password,
  database: redisConfig.db,
  keyPrefix: redisConfig.keyPrefix
});

// Event listeners
redisClient.on('connect', () => {
  logger.info('✅ Redis client connected');
});

redisClient.on('ready', () => {
  logger.info('✅ Redis client ready');
});

redisClient.on('error', (error) => {
  logger.error('❌ Redis client error:', error);
});

redisClient.on('end', () => {
  logger.warn('⚠️ Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  logger.info('🔄 Redis client reconnecting...');
});

// Cache wrapper class
class RedisCache {
  constructor(client) {
    this.client = client;
  }

  // Get value by key
  async get(key, options = {}) {
    try {
      const value = await this.client.get(key);
      if (!value) return null;

      const { json = true } = options;
      return json ? JSON.parse(value) : value;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  // Set value with TTL
  async set(key, value, ttlSeconds = redisConfig.ttl.temporary, options = {}) {
    try {
      const { json = true } = options;
      const serializedValue = json ? JSON.stringify(value) : value;
      
      if (ttlSeconds > 0) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  // Delete key
  async del(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  // Set expiration
  async expire(key, ttlSeconds) {
    try {
      return await this.client.expire(key, ttlSeconds);
    } catch (error) {
      logger.error(`Redis expire error for key ${key}:`, error);
      return false;
    }
  }

  // Get TTL
  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      return -2;
    }
  }

  // Increment counter
  async incr(key, by = 1) {
    try {
      return await this.client.incrBy(key, by);
    } catch (error) {
      logger.error(`Redis increment error for key ${key}:`, error);
      return 0;
    }
  }

  // Set key with TTL only if it doesn't exist
  async setnx(key, value, ttlSeconds) {
    try {
      const { json = true } = options;
      const serializedValue = json ? JSON.stringify(value) : value;
      
      if (ttlSeconds > 0) {
        return await this.client.set(key, serializedValue, 'EX', ttlSeconds, 'NX');
      } else {
        return await this.client.set(key, serializedValue, 'NX');
      }
    } catch (error) {
      logger.error(`Redis setnx error for key ${key}:`, error);
      return null;
    }
  }

  // Get or set pattern
  async getset(key, ttlSeconds, callback) {
    try {
      let value = await this.get(key);
      
      if (value === null) {
        value = await callback();
        await this.set(key, value, ttlSeconds);
      }
      
      return value;
    } catch (error) {
      logger.error(`Redis getset error for key ${key}:`, error);
      return null;
    }
  }

  // Batch operations
  async mget(keys) {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs) {
    try {
      const values = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        values.push(key, JSON.stringify(value));
      }
      return await this.client.mSet(values);
    } catch (error) {
      logger.error('Redis mset error:', error);
      return false;
    }
  }

  // Pattern-based deletion
  async delPattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        return await this.client.del(keys);
      }
      return 0;
    } catch (error) {
      logger.error(`Redis delPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  // Rate limiting
  async rateLimit(key, limit, window) {
    try {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, window);
      }
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime: Math.ceil(Date.now() / 1000) + window
      };
    } catch (error) {
      logger.error(`Redis rateLimit error for key ${key}:`, error);
      return { allowed: true, remaining: limit, resetTime: 0 };
    }
  }

  // Session management
  async setSession(sessionId, data, ttlSeconds = redisConfig.ttl.session) {
    const key = `session:${sessionId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // Analysis caching
  async cacheAnalysis(analysisId, data, ttlSeconds = redisConfig.ttl.analysis) {
    const key = `analysis:${analysisId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getAnalysis(analysisId) {
    const key = `analysis:${analysisId}`;
    return await this.get(key);
  }

  // User caching
  async cacheUser(userId, data, ttlSeconds = redisConfig.ttl.user) {
    const key = `user:${userId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getUser(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  // Food data caching
  async cacheFood(foodId, data, ttlSeconds = redisConfig.ttl.food) {
    const key = `food:${foodId}`;
    return await this.set(key, data, ttlSeconds);
  }

  async getFood(foodId) {
    const key = `food:${foodId}`;
    return await this.get(key);
  }

  // ML results caching
  async cacheMLResult(key, data, ttlSeconds = redisConfig.ttl.ml) {
    const fullKey = `ml:${key}`;
    return await this.set(fullKey, data, ttlSeconds);
  }

  async getMLResult(key) {
    const fullKey = `ml:${key}`;
    return await this.get(fullKey);
  }

  // Health check
  async ping() {
    try {
      const result = await this.client.ping();
      return { status: 'healthy', ping: result, timestamp: new Date() };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }
}

// Create cache instance
const cache = new RedisCache(redisClient);

export { redisClient, cache, redisConfig };
export default cache;