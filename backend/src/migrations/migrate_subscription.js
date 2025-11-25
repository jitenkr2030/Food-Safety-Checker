const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runMigration() {
  console.log('🔄 Starting Subscription System Migration...');
  
  const client = await pool.connect();
  
  try {
    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'premium', 'family', 'restaurant', 'business', 'enterprise')),
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'INR',
        payment_provider VARCHAR(20) DEFAULT 'razorpay' CHECK (payment_provider IN ('razorpay', 'stripe')),
        provider_subscription_id VARCHAR(100) UNIQUE,
        current_period_start TIMESTAMP WITH TIME ZONE,
        current_period_end TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created subscriptions table');

    // Create usage_tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        analyses_count INTEGER NOT NULL DEFAULT 0,
        video_analyses_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);
    console.log('✅ Created usage_tracking table');

    // Create family_members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        accepted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(subscription_id, user_id)
      );
    `);
    console.log('✅ Created family_members table');

    // Create payment_transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        transaction_id VARCHAR(100) NOT NULL,
        payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN ('razorpay', 'stripe')),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'INR',
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
        payment_method VARCHAR(50),
        gateway_response JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_id, payment_provider)
      );
    `);
    console.log('✅ Created payment_transactions table');

    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_family_members_subscription_id ON family_members(subscription_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON payment_transactions(subscription_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);');
    console.log('✅ Created database indexes');

    // Create function for daily usage reset (to be called by cron job)
    await client.query(`
      CREATE OR REPLACE FUNCTION reset_daily_usage()
      RETURNS void AS $$
      BEGIN
        INSERT INTO usage_tracking (user_id, date, analyses_count, video_analyses_count)
        SELECT user_id, CURRENT_DATE, 0, 0
        FROM users
        WHERE NOT EXISTS (
          SELECT 1 FROM usage_tracking ut 
          WHERE ut.user_id = users.id AND ut.date = CURRENT_DATE
        );
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created usage reset function');

    console.log('🎉 Subscription System Migration Completed Successfully!');
    console.log('📋 Summary:');
    console.log('   - subscriptions table: Subscription management with 6 tiers');
    console.log('   - usage_tracking table: Daily usage limits enforcement');
    console.log('   - family_members table: Family plan member management');
    console.log('   - payment_transactions table: Payment tracking and auditing');
    console.log('   - Indexes: Performance optimization');
    console.log('   - Functions: Automated daily usage reset');
    console.log('');
    console.log('🚀 Ready for Revenue Generation!');
    console.log('   - Free Tier: 5 analyses/day (Customer Acquisition)');
    console.log('   - Premium: ₹299/month (Unlimited + Video Analysis)');
    console.log('   - Family: ₹599/month (6 family members)');
    console.log('   - Restaurant: ₹2,999/month (Staff training + Compliance)');
    console.log('   - Business: ₹9,999/month (Multi-location management)');
    console.log('   - Enterprise: ₹29,999/month (White-label + Unlimited API)');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('✅ Database migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });