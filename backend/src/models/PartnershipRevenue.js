const db = require('../config/database');

class PartnershipRevenue {
  // E-commerce Integration (3-8% commission on safe food sales)
  static async recordEcommerceCommission(userId, orderId, amount, platform, productId) {
    const commissionRate = this.getCommissionRate(platform);
    const commissionAmount = amount * commissionRate;
    
    const query = `
      INSERT INTO partnership_revenue (
        user_id, revenue_type, revenue_category, amount, currency,
        commission_rate, source_platform, source_order_id, source_product_id,
        transaction_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      userId,
      'commission',
      'ecommerce_integration',
      commissionAmount,
      'INR',
      commissionRate,
      platform,
      orderId,
      productId,
      JSON.stringify({
        order_amount: amount,
        product_safe_certified: true,
        partner_store: platform
      }),
      'completed'
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static getCommissionRate(platform) {
    const rates = {
      'amazon_fresh': 0.08,    // 8%
      'bigbasket': 0.07,       // 7%
      'zepto': 0.06,           // 6%
      'swiggy_instamart': 0.05, // 5%
      'blinkit': 0.05,         // 5%
      '-reliance_fresh': 0.04, // 4%
      'd_mart': 0.03           // 3%
    };
    return rates[platform] || 0.05; // Default 5%
  }

  // Delivery Platforms (₹1-2 per order)
  static async recordDeliveryCommission(userId, orderId, platform, restaurantName) {
    const commissionAmount = this.getDeliveryCommission(platform, restaurantName);
    
    const query = `
      INSERT INTO partnership_revenue (
        user_id, revenue_type, revenue_category, amount, currency,
        commission_rate, source_platform, source_order_id, source_restaurant_name,
        transaction_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      userId,
      'commission',
      'delivery_platform',
      commissionAmount,
      'INR',
      1, // Fixed amount per order
      platform,
      orderId,
      restaurantName,
      JSON.stringify({
        commission_per_order: commissionAmount,
        food_safety_verified: true,
        partner_restaurant: restaurantName
      }),
      'completed'
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static getDeliveryCommission(platform, restaurantType) {
    const baseCommissions = {
      'swiggy': 1.5,    // ₹1.5 per order
      'zomato': 1.5,    // ₹1.5 per order
      'ubereats': 1.2,  // ₹1.2 per order
      'dunzo': 2.0      // ₹2 per order
    };
    
    const premiumRestaurantBonus = ['fine_dining', '5_star', 'premium'].includes(restaurantType) ? 0.5 : 0;
    return (baseCommissions[platform] || 1.0) + premiumRestaurantBonus;
  }

  // Healthcare Programs (₹10K-50K/month)
  static async recordHealthcareRevenue(partnerId, programType, monthlyAmount, contractDuration) {
    const query = `
      INSERT INTO partnership_revenue (
        partner_id, revenue_type, revenue_category, amount, currency,
        program_type, contract_duration_months, source_healthcare_partner,
        transaction_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      partnerId,
      'subscription',
      'healthcare_program',
      monthlyAmount,
      'INR',
      programType,
      contractDuration,
      'healthcare_system',
      JSON.stringify({
        monthly_fee: monthlyAmount,
        annual_revenue: monthlyAmount * contractDuration,
        program_scope: `${programType} integration`
      }),
      'active'
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Market Research Reports (₹25K-3L)
  static async recordResearchReportRevenue(buyerId, reportType, amount, reportData) {
    const query = `
      INSERT INTO partnership_revenue (
        buyer_id, revenue_type, revenue_category, amount, currency,
        report_type, report_delivery_date, source_research_buyer,
        transaction_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      buyerId,
      'one_time',
      'market_research',
      amount,
      'INR',
      reportType,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days delivery
      'research_buyer',
      JSON.stringify({
        report_scope: reportData.scope,
        data_sources: reportData.sources,
        analysis_depth: reportData.depth,
        delivery_timeline: '30 days'
      }),
      'pending_delivery'
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Government Contracts (₹10L-1Cr)
  static async recordGovernmentContractRevenue(contractId, amount, contractType, durationMonths) {
    const query = `
      INSERT INTO partnership_revenue (
        contract_id, revenue_type, revenue_category, amount, currency,
        contract_type, contract_duration_months, source_government_agency,
        transaction_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      contractId,
      'contract',
      'government_contract',
      amount,
      'INR',
      contractType,
      durationMonths,
      'government_portal',
      JSON.stringify({
        contract_scope: `Public health food safety monitoring`,
        milestones: durationMonths,
        compliance_requirements: ['FSSAI', 'ISO 22000', 'HACCP']
      }),
      'in_progress'
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Academic Partnerships (₹2L-20L)
  static async recordAcademicPartnershipRevenue(institutionId, partnershipType, amount, researchScope) {
    const query = `
      INSERT INTO partnership_revenue (
        institution_id, revenue_type, revenue_category, amount, currency,
        partnership_type, research_scope, source_academic_institution,
        transaction_data, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    
    const values = [
      institutionId,
      'partnership',
      'academic_research',
      amount,
      'INR',
      partnershipType,
      researchScope,
      'academic_institution',
      JSON.stringify({
        research_focus: researchScope.focus,
        publication_rights: researchScope.publications,
        data_sharing: researchScope.data_sharing,
        collaboration_period: researchScope.period
      }),
      'active'
    ];
    
    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Revenue Analytics
  static async getRevenueSummary(timeframe = '30d') {
    const dateCondition = this.getDateCondition(timeframe);
    
    const query = `
      SELECT 
        revenue_category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_transaction,
        COUNT(DISTINCT user_id) as unique_customers
      FROM partnership_revenue 
      WHERE ${dateCondition}
      GROUP BY revenue_category
      ORDER BY total_revenue DESC;
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  static async getPartnershipMetrics() {
    const query = `
      SELECT 
        revenue_category,
        source_platform,
        COUNT(*) as partnerships,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_partnership_value
      FROM partnership_revenue 
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY revenue_category, source_platform
      ORDER BY total_revenue DESC;
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  static getDateCondition(timeframe) {
    const conditions = {
      '7d': "created_at >= CURRENT_DATE - INTERVAL '7 days'",
      '30d': "created_at >= CURRENT_DATE - INTERVAL '30 days'",
      '90d': "created_at >= CURRENT_DATE - INTERVAL '90 days'",
      '1y': "created_at >= CURRENT_DATE - INTERVAL '1 year'"
    };
    return conditions[timeframe] || conditions['30d'];
  }

  // Project revenue based on user adoption
  static async projectRevenue(userId, projectionDays = 365) {
    // Based on current user base and conversion rates
    const baseProjections = {
      ecommerce_integration: 15000 * 0.08,      // 15K users * 8% conversion * avg order
      delivery_platform: 25000 * 1.5,          // 25K daily orders * ₹1.5 commission
      healthcare_program: 50 * 30000,          // 50 hospital partnerships * ₹30K/month
      market_research: 200 * 75000,            // 200 research reports * ₹75K avg
      government_contract: 5 * 5000000,        // 5 government contracts * ₹50L avg
      academic_partnership: 30 * 1100000       // 30 academic partnerships * ₹11L avg
    };

    // Scale based on projection period
    const monthlyMultiplier = projectionDays / 30;
    
    const projections = Object.entries(baseProjections).map(([category, monthlyRevenue]) => ({
      category,
      monthly_revenue: monthlyRevenue,
      yearly_revenue: monthlyRevenue * 12,
      projected_customers: Math.floor(monthlyRevenue / (category.includes('research') ? 75000 : 
                                                   category.includes('government') ? 5000000 :
                                                   category.includes('healthcare') ? 30000 :
                                                   category.includes('delivery') ? 1.5 : 15000))
    }));

    return {
      projection_period_days: projectionDays,
      total_monthly_revenue: projections.reduce((sum, p) => sum + p.monthly_revenue, 0),
      total_yearly_revenue: projections.reduce((sum, p) => sum + p.yearly_revenue, 0),
      categories: projections
    };
  }
}

module.exports = PartnershipRevenue;