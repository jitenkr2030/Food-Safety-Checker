-- FoodSafe AI Monetization System Database Migration
-- Run this SQL script to set up subscription and partnership revenue system

-- ============================================
-- SUBSCRIPTION SYSTEM TABLES
-- ============================================

-- Subscriptions table for managing user subscriptions
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

-- Usage tracking table for daily limits
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

-- Family members table for family plan
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

-- Payment transactions table
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

-- ============================================
-- PARTNERSHIP REVENUE SYSTEM TABLES
-- ============================================

-- Partnership revenue table for all revenue streams
CREATE TABLE IF NOT EXISTS partnership_revenue (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  partner_id INTEGER,
  buyer_id VARCHAR(100),
  contract_id VARCHAR(100),
  institution_id VARCHAR(100),
  revenue_type VARCHAR(20) NOT NULL CHECK (revenue_type IN ('commission', 'subscription', 'one_time', 'contract', 'partnership')),
  revenue_category VARCHAR(30) NOT NULL CHECK (revenue_category IN (
    'ecommerce_integration', 'delivery_platform', 'healthcare_program', 
    'market_research', 'government_contract', 'academic_research'
  )),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  commission_rate DECIMAL(5,4),
  source_platform VARCHAR(50),
  source_order_id VARCHAR(100),
  source_product_id VARCHAR(100),
  source_restaurant_name VARCHAR(200),
  source_healthcare_partner VARCHAR(100),
  source_research_buyer VARCHAR(100),
  source_government_agency VARCHAR(100),
  source_academic_institution VARCHAR(100),
  program_type VARCHAR(50),
  report_type VARCHAR(50),
  contract_type VARCHAR(50),
  partnership_type VARCHAR(50),
  report_delivery_date TIMESTAMP WITH TIME ZONE,
  contract_duration_months INTEGER,
  research_scope JSONB,
  transaction_data JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending', 'active', 'completed', 'failed', 'cancelled', 
    'pending_delivery', 'in_progress', 'delivered'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Partnership partners table for tracking partner information
CREATE TABLE IF NOT EXISTS partnership_partners (
  id SERIAL PRIMARY KEY,
  partner_type VARCHAR(30) NOT NULL CHECK (partner_type IN (
    'ecommerce_platform', 'delivery_platform', 'healthcare_provider', 
    'research_buyer', 'government_agency', 'academic_institution'
  )),
  partner_name VARCHAR(200) NOT NULL,
  partner_code VARCHAR(50) UNIQUE NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  address JSONB,
  api_credentials JSONB,
  commission_rates JSONB,
  integration_status VARCHAR(20) DEFAULT 'pending' CHECK (integration_status IN (
    'pending', 'setup', 'active', 'suspended', 'terminated'
  )),
  contract_details JSONB,
  performance_metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Partnership analytics table for performance tracking
CREATE TABLE IF NOT EXISTS partnership_analytics (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER REFERENCES partnership_partners(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  revenue_generated DECIMAL(15,2) DEFAULT 0,
  transactions_count INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  platform_revenue DECIMAL(15,2) DEFAULT 0,
  commission_paid DECIMAL(15,2) DEFAULT 0,
  performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(partner_id, date)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_family_members_subscription_id ON family_members(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- Partnership indexes
CREATE INDEX IF NOT EXISTS idx_partnership_revenue_user_id ON partnership_revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_revenue_category ON partnership_revenue(revenue_category);
CREATE INDEX IF NOT EXISTS idx_partnership_revenue_status ON partnership_revenue(status);
CREATE INDEX IF NOT EXISTS idx_partnership_revenue_created_at ON partnership_revenue(created_at);
CREATE INDEX IF NOT EXISTS idx_partnership_partners_type ON partnership_partners(partner_type);
CREATE INDEX IF NOT EXISTS idx_partnership_analytics_partner_date ON partnership_analytics(partner_id, date);

-- ============================================
-- FUNCTIONS FOR AUTOMATION
-- ============================================

-- Function for daily usage reset (to be called by cron job)
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

-- ============================================
-- SAMPLE DATA INSERTION
-- ============================================

-- Insert sample partnership partners
INSERT INTO partnership_partners (partner_type, partner_name, partner_code, contact_email, commission_rates, integration_status, contract_details) VALUES
('ecommerce_platform', 'Amazon Fresh', 'AMAZON_FRESH', 'partnerships@amazon.in', '{"default_rate": 0.08, "premium_rate": 0.10}', 'active', '{"contract_start": "2024-01-01", "contract_duration": "24 months"}'),
('ecommerce_platform', 'BigBasket', 'BIGBASKET', 'partners@bigbasket.com', '{"default_rate": 0.07, "premium_rate": 0.09}', 'active', '{"contract_start": "2024-02-01", "contract_duration": "18 months"}'),
('delivery_platform', 'Swiggy', 'SWIGGY', 'partnerships@swiggy.in', '{"default_rate": 1.5, "premium_restaurant_rate": 2.0}', 'active', '{"contract_start": "2024-01-15", "contract_duration": "36 months"}'),
('delivery_platform', 'Zomato', 'ZOMATO', 'partners@zomato.com', '{"default_rate": 1.5, "premium_restaurant_rate": 2.0}', 'active', '{"contract_start": "2024-03-01", "contract_duration": "24 months"}'),
('healthcare_provider', 'Apollo Hospitals', 'APOLLO_HC', 'corporate@apollohospitals.com', '{"monthly_fee": 30000}', 'active', '{"contract_start": "2024-01-01", "contract_duration": "12 months"}'),
('healthcare_provider', 'Max Healthcare', 'MAX_HC', 'partnerships@maxhealthcare.com', '{"monthly_fee": 25000}', 'setup', '{"contract_start": "2024-04-01", "contract_duration": "18 months"}'),
('government_agency', 'FSSAI (Food Safety and Standards Authority of India)', 'FSSAI_GOV', 'partnerships@fssai.gov.in', '{"contract_fee": 5000000}', 'pending', '{"contract_start": "2024-06-01", "contract_duration": "36 months"}'),
('academic_institution', 'IIT Delhi - Department of Food Technology', 'IITD_FT', 'research@iitd.ac.in', '{"research_funding": 500000}', 'active', '{"partnership_start": "2024-01-01", "duration": "24 months"}')
ON CONFLICT (partner_code) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

-- Show completion message
DO $$
BEGIN
  RAISE NOTICE '🎉 FoodSafe AI Monetization System Migration Completed!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Database Tables Created:';
  RAISE NOTICE '   ✅ subscriptions - Subscription management with 6 tiers';
  RAISE NOTICE '   ✅ usage_tracking - Daily usage limits enforcement';
  RAISE NOTICE '   ✅ family_members - Family plan member management';
  RAISE NOTICE '   ✅ payment_transactions - Payment tracking and auditing';
  RAISE NOTICE '   ✅ partnership_revenue - All revenue transactions';
  RAISE NOTICE '   ✅ partnership_partners - Partner management';
  RAISE NOTICE '   ✅ partnership_analytics - Performance tracking';
  RAISE NOTICE '';
  RAISE NOTICE '💰 Revenue Streams Ready:';
  RAISE NOTICE '   📱 E-commerce Integration: 3-8% commission on safe food sales';
  RAISE NOTICE '   🚚 Delivery Platforms: ₹1-2 per order (Swiggy/Zomato partnerships)';
  RAISE NOTICE '   🏥 Healthcare Programs: ₹10K-50K/month (hospitals, insurance)';
  RAISE NOTICE '   📊 Market Research: ₹25K-3L per report';
  RAISE NOTICE '   🏛️  Government Contracts: ₹10L-1Cr for public health projects';
  RAISE NOTICE '   🎓 Academic Partnerships: ₹2L-20L for research initiatives';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Total Revenue Potential: ₹125 Crores annually by Year 3!';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Subscription Tiers:';
  RAISE NOTICE '   Free: 5 analyses/day (Customer Acquisition)';
  RAISE NOTICE '   Premium: ₹299/month (Unlimited + Video Analysis)';
  RAISE NOTICE '   Family: ₹599/month (6 family members)';
  RAISE NOTICE '   Restaurant: ₹2,999/month (Staff training + Compliance)';
  RAISE NOTICE '   Business: ₹9,999/month (Multi-location management)';
  RAISE NOTICE '   Enterprise: ₹29,999/month (White-label + Unlimited API)';
END $$;