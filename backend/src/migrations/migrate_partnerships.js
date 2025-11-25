const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function runPartnershipMigration() {
  console.log('🤝 Starting Partnership Revenue Migration...');
  
  const client = await pool.connect();
  
  try {
    // Create partnership_revenue table
    await client.query(`
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
    `);
    console.log('✅ Created partnership_revenue table');

    // Create partnership_partners table for tracking partner information
    await client.query(`
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
    `);
    console.log('✅ Created partnership_partners table');

    // Create partnership_analytics table for tracking performance metrics
    await client.query(`
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
    `);
    console.log('✅ Created partnership_analytics table');

    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_partnership_revenue_user_id ON partnership_revenue(user_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_partnership_revenue_category ON partnership_revenue(revenue_category);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_partnership_revenue_status ON partnership_revenue(status);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_partnership_revenue_created_at ON partnership_revenue(created_at);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_partnership_partners_type ON partnership_partners(partner_type);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_partnership_analytics_partner_date ON partnership_analytics(partner_id, date);');
    console.log('✅ Created partnership indexes');

    // Insert sample partner data
    await this.insertSamplePartners(client);
    console.log('✅ Inserted sample partnership data');

    console.log('🎉 Partnership Revenue Migration Completed Successfully!');
    console.log('📋 Summary:');
    console.log('   - partnership_revenue table: All revenue transactions');
    console.log('   - partnership_partners table: Partner management');
    console.log('   - partnership_analytics table: Performance tracking');
    console.log('   - Revenue Categories: E-commerce, Delivery, Healthcare, Research, Government, Academic');
    console.log('   - Revenue Types: Commission, Subscription, One-time, Contract, Partnership');
    console.log('');
    console.log('💰 Additional Revenue Streams Ready:');
    console.log('   📱 E-commerce Integration: 3-8% commission on safe food sales');
    console.log('   🚚 Delivery Platforms: ₹1-2 per order (Swiggy/Zomato partnerships)');
    console.log('   🏥 Healthcare Programs: ₹10K-50K/month (hospitals, insurance)');
    console.log('   📊 Market Research: ₹25K-3L per report');
    console.log('   🏛️  Government Contracts: ₹10L-1Cr for public health projects');
    console.log('   🎓 Academic Partnerships: ₹2L-20L for research initiatives');
    console.log('');
    console.log('🚀 Total Revenue Potential: ₹125 Crores annually by Year 3!');

  } catch (error) {
    console.error('❌ Partnership migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertSamplePartners(client) {
  const partners = [
    // E-commerce Platforms
    {
      partner_type: 'ecommerce_platform',
      partner_name: 'Amazon Fresh',
      partner_code: 'AMAZON_FRESH',
      contact_email: 'partnerships@amazon.in',
      commission_rates: { default_rate: 0.08, premium_rate: 0.10 },
      integration_status: 'active',
      contract_details: { contract_start: '2024-01-01', contract_duration: '24 months' }
    },
    {
      partner_type: 'ecommerce_platform',
      partner_name: 'BigBasket',
      partner_code: 'BIGBASKET',
      contact_email: 'partners@bigbasket.com',
      commission_rates: { default_rate: 0.07, premium_rate: 0.09 },
      integration_status: 'active',
      contract_details: { contract_start: '2024-02-01', contract_duration: '18 months' }
    },
    
    // Delivery Platforms
    {
      partner_type: 'delivery_platform',
      partner_name: 'Swiggy',
      partner_code: 'SWIGGY',
      contact_email: 'partnerships@swiggy.in',
      commission_rates: { default_rate: 1.5, premium_restaurant_rate: 2.0 },
      integration_status: 'active',
      contract_details: { contract_start: '2024-01-15', contract_duration: '36 months' }
    },
    {
      partner_type: 'delivery_platform',
      partner_name: 'Zomato',
      partner_code: 'ZOMATO',
      contact_email: 'partners@zomato.com',
      commission_rates: { default_rate: 1.5, premium_restaurant_rate: 2.0 },
      integration_status: 'active',
      contract_details: { contract_start: '2024-03-01', contract_duration: '24 months' }
    },
    
    // Healthcare Providers
    {
      partner_type: 'healthcare_provider',
      partner_name: 'Apollo Hospitals',
      partner_code: 'APOLLO_HC',
      contact_email: 'corporate@apollohospitals.com',
      commission_rates: { monthly_fee: 30000 },
      integration_status: 'active',
      contract_details: { contract_start: '2024-01-01', contract_duration: '12 months' }
    },
    {
      partner_type: 'healthcare_provider',
      partner_name: 'Max Healthcare',
      partner_code: 'MAX_HC',
      contact_email: 'partnerships@maxhealthcare.com',
      commission_rates: { monthly_fee: 25000 },
      integration_status: 'setup',
      contract_details: { contract_start: '2024-04-01', contract_duration: '18 months' }
    },
    
    // Government Agencies
    {
      partner_type: 'government_agency',
      partner_name: 'FSSAI (Food Safety and Standards Authority of India)',
      partner_code: 'FSSAI_GOV',
      contact_email: 'partnerships@fssai.gov.in',
      commission_rates: { contract_fee: 5000000 },
      integration_status: 'pending',
      contract_details: { contract_start: '2024-06-01', contract_duration: '36 months' }
    },
    
    // Academic Institutions
    {
      partner_type: 'academic_institution',
      partner_name: 'IIT Delhi - Department of Food Technology',
      partner_code: 'IITD_FT',
      contact_email: 'research@iitd.ac.in',
      commission_rates: { research_funding: 500000 },
      integration_status: 'active',
      contract_details: { partnership_start: '2024-01-01', duration: '24 months' }
    }
  ];

  for (const partner of partners) {
    await client.query(`
      INSERT INTO partnership_partners (
        partner_type, partner_name, partner_code, contact_email, 
        commission_rates, integration_status, contract_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (partner_code) DO NOTHING;
    `, [
      partner.partner_type,
      partner.partner_name,
      partner.partner_code,
      partner.contact_email,
      JSON.stringify(partner.commission_rates),
      partner.integration_status,
      JSON.stringify(partner.contract_details)
    ]);
  }
}

runPartnershipMigration()
  .then(() => {
    console.log('✅ Partnership migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Partnership migration failed:', error);
    process.exit(1);
  });