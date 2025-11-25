import knex from 'knex';
import logger from '../utils/logger.js';

const config = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'foodsafe_dev',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    },
    debug: true
  },
  
  testing: {
    client: 'postgresql',
    connection: {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5432,
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'password',
      database: process.env.TEST_DB_NAME || 'foodsafe_test',
      ssl: false
    },
    pool: {
      min: 1,
      max: 1
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    },
    debug: false
  },

  staging: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }
    },
    pool: {
      min: 5,
      max: 20
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { 
        rejectUnauthorized: false,
        sslmode: 'require'
      }
    },
    pool: {
      min: 10,
      max: 30,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 60000
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations'
    },
    acquireConnectionTimeout: 60000
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

if (!dbConfig) {
  throw new Error(`Invalid environment: ${environment}`);
}

// Create database connection
const db = knex(dbConfig);

// Test connection
export const connectDB = async () => {
  try {
    await db.raw('SELECT 1');
    logger.info(`✅ Database connected successfully (${environment})`);
    
    // Run migrations if in development
    if (environment === 'development') {
      await runMigrations();
    }
    
    return db;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Run migrations
export const runMigrations = async () => {
  try {
    const [batchNo, migrations] = await db.migrate.latest();
    if (batchNo > 0) {
      logger.info(`✅ Database migrations completed (batch ${batchNo})`);
    } else {
      logger.info('✅ Database migrations are up to date');
    }
  } catch (error) {
    logger.error('❌ Database migration failed:', error);
    throw error;
  }
};

// Rollback migrations
export const rollbackMigrations = async () => {
  try {
    await db.migrate.rollback();
    logger.info('✅ Database rollback completed');
  } catch (error) {
    logger.error('❌ Database rollback failed:', error);
    throw error;
  }
};

// Seed database
export const seedDatabase = async () => {
  try {
    if (environment === 'development' || environment === 'testing') {
      await db.seed.run();
      logger.info('✅ Database seeded successfully');
    }
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  }
};

// Health check for database
export const checkDBHealth = async () => {
  try {
    await db.raw('SELECT 1');
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date() };
  }
};

// Transaction helper
export const transaction = async (callback) => {
  try {
    const result = await db.transaction(callback);
    return result;
  } catch (error) {
    logger.error('Transaction failed:', error);
    throw error;
  }
};

// Get query builder
export const queryBuilder = (tableName) => {
  return db(tableName);
};

// Close database connection
export const closeDB = async () => {
  try {
    await db.destroy();
    logger.info('✅ Database connection closed');
  } catch (error) {
    logger.error('❌ Error closing database connection:', error);
    throw error;
  }
};

// Export database instance
export default db;

// For testing purposes
if (process.env.NODE_ENV === 'test') {
  global.db = db;
}