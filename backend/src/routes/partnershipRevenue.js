const express = require('express');
const PartnershipService = require('../services/PartnershipService');
const PartnershipRevenue = require('../models/PartnershipRevenue');
const { body, query, validationResult } = require('express-validator');

const router = express.Router();

// Middleware to validate request
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  next();
};

// E-commerce Integration Routes
/**
 * POST /api/partnerships/ecommerce/commission
 * Record e-commerce commission on safe food sales
 */
router.post('/ecommerce/commission', [
  body('platform').isIn(['amazon_fresh', 'bigbasket', 'zepto', 'swiggy_instamart', 'blinkit', 'reliance_fresh', 'd_mart']),
  body('orderId').notEmpty(),
  body('amount').isFloat({ min: 0 }),
  body('products').isArray(),
  body('userId').isInt()
], validate, async (req, res) => {
  try {
    const result = await PartnershipService.processEcommerceSale(req.body.userId, req.body);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'E-commerce commission recorded successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        data: result
      });
    }
  } catch (error) {
    console.error('E-commerce commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process e-commerce commission',
      error: error.message
    });
  }
});

/**
 * GET /api/partnerships/ecommerce/analytics
 * Get e-commerce partnership analytics
 */
router.get('/ecommerce/analytics', [
  query('timeframe').optional().isIn(['7d', '30d', '90d', '1y']),
  query('platform').optional().isIn(['amazon_fresh', 'bigbasket', 'zepto', 'swiggy_instamart', 'blinkit', 'reliance_fresh', 'd_mart'])
], validate, async (req, res) => {
  try {
    const { timeframe = '30d', platform } = req.query;
    
    let query = 'revenue_category = $1 AND created_at >= CURRENT_DATE - INTERVAL $2';
    const params = ['ecommerce_integration', timeframe];
    
    if (platform) {
      query += ' AND source_platform = $3';
      params.push(platform);
    }
    
    const analytics = await PartnershipRevenue.db.query(`
      SELECT 
        source_platform,
        COUNT(*) as commission_count,
        SUM(amount) as total_commission,
        AVG(amount) as avg_commission,
        COUNT(DISTINCT user_id) as unique_customers
      FROM partnership_revenue 
      WHERE ${query}
      GROUP BY source_platform
      ORDER BY total_commission DESC;
    `, params);
    
    res.json({
      success: true,
      message: 'E-commerce analytics retrieved successfully',
      data: {
        timeframe,
        platform_filter: platform,
        analytics: analytics.rows,
        summary: {
          total_commission: analytics.rows.reduce((sum, row) => sum + parseFloat(row.total_commission), 0),
          total_transactions: analytics.rows.reduce((sum, row) => sum + parseInt(row.commission_count), 0)
        }
      }
    });
  } catch (error) {
    console.error('E-commerce analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve e-commerce analytics',
      error: error.message
    });
  }
});

// Delivery Platform Routes
/**
 * POST /api/partnerships/delivery/commission
 * Record delivery platform commission
 */
router.post('/delivery/commission', [
  body('platform').isIn(['swiggy', 'zomato', 'ubereats', 'dunzo']),
  body('orderId').notEmpty(),
  body('restaurantName').notEmpty(),
  body('restaurantType').isIn(['fast_food', 'casual_dining', 'fine_dining', '5_star', 'premium', 'regular']),
  body('orderAmount').isFloat({ min: 0 }),
  body('foodSafetyScore').isFloat({ min: 0, max: 100 }),
  body('userId').isInt()
], validate, async (req, res) => {
  try {
    const result = await PartnershipService.processDeliveryOrder(req.body.userId, req.body);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Delivery commission recorded successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        data: result
      });
    }
  } catch (error) {
    console.error('Delivery commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process delivery commission',
      error: error.message
    });
  }
});

// Healthcare Program Routes
/**
 * POST /api/partnerships/healthcare/setup
 * Setup healthcare program partnership
 */
router.post('/healthcare/setup', [
  body('partnerId').notEmpty(),
  body('programType').isIn(['hospital_integration', 'insurance_compliance', 'employee_wellness']),
  body('monthlyFee').isFloat({ min: 10000, max: 50000 }),
  body('contractDuration').isInt({ min: 1, max: 60 }),
  body('integrationType').isIn(['api', 'white_label', 'bulk_licensing'])
], validate, async (req, res) => {
  try {
    const result = await PartnershipService.setupHealthcarePartnership(req.body);
    
    res.json({
      success: true,
      message: 'Healthcare partnership setup successfully',
      data: result
    });
  } catch (error) {
    console.error('Healthcare partnership error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup healthcare partnership',
      error: error.message
    });
  }
});

/**
 * GET /api/partnerships/healthcare/partners
 * Get healthcare partnership metrics
 */
router.get('/healthcare/partners', async (req, res) => {
  try {
    const partners = await PartnershipRevenue.db.query(`
      SELECT 
        partner_id,
        program_type,
        SUM(amount) as total_revenue,
        COUNT(*) as active_contracts,
        AVG(amount) as avg_monthly_fee,
        MIN(created_at) as partnership_start,
        status
      FROM partnership_revenue 
      WHERE revenue_category = 'healthcare_program'
      GROUP BY partner_id, program_type, status
      ORDER BY total_revenue DESC;
    `);
    
    res.json({
      success: true,
      message: 'Healthcare partners retrieved successfully',
      data: {
        partners: partners.rows,
        summary: {
          total_partners: partners.rows.length,
          total_revenue: partners.rows.reduce((sum, p) => sum + parseFloat(p.total_revenue), 0),
          avg_partnership_value: partners.rows.reduce((sum, p) => sum + parseFloat(p.avg_monthly_fee), 0) / partners.rows.length
        }
      }
    });
  } catch (error) {
    console.error('Healthcare partners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve healthcare partners',
      error: error.message
    });
  }
});

// Market Research Routes
/**
 * POST /api/partnerships/research/report
 * Generate and sell market research report
 */
router.post('/research/report', [
  body('buyerId').notEmpty(),
  body('reportType').isIn(['industry_analysis', 'consumer_behavior', 'safety_trends', 'competitive_landscape']),
  body('reportScope').notEmpty(),
  body('depth').isIn(['basic', 'comprehensive', 'executive', 'deep_dive']),
  body('customQueries').optional().isArray()
], validate, async (req, res) => {
  try {
    const result = await PartnershipService.generateMarketResearchReport(req.body);
    
    res.json({
      success: true,
      message: 'Market research report generated successfully',
      data: result
    });
  } catch (error) {
    console.error('Market research error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate market research report',
      error: error.message
    });
  }
});

/**
 * GET /api/partnerships/research/reports
 * Get market research reports inventory
 */
router.get('/research/reports', async (req, res) => {
  try {
    const reports = await PartnershipRevenue.db.query(`
      SELECT 
        report_type,
        COUNT(*) as orders,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_price,
        AVG(CASE WHEN status = 'delivered' THEN EXTRACT(DAY FROM (updated_at - created_at)) END) as avg_delivery_days
      FROM partnership_revenue 
      WHERE revenue_category = 'market_research'
      GROUP BY report_type
      ORDER BY total_revenue DESC;
    `);
    
    res.json({
      success: true,
      message: 'Market research reports retrieved successfully',
      data: reports.rows
    });
  } catch (error) {
    console.error('Market research reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve market research reports',
      error: error.message
    });
  }
});

// Government Contract Routes
/**
 * POST /api/partnerships/government/contract
 * Submit government contract proposal
 */
router.post('/government/contract', [
  body('contractId').notEmpty(),
  body('agencyType').isIn(['fssai', 'mohfw', 'state_health', 'municipal']),
  body('contractValue').isFloat({ min: 1000000, max: 10000000 }),
  body('durationMonths').isInt({ min: 6, max: 60 }),
  body('projectScope').notEmpty()
], validate, async (req, res) => {
  try {
    const result = await PartnershipService.submitGovernmentContract(req.body);
    
    res.json({
      success: true,
      message: 'Government contract submitted successfully',
      data: result
    });
  } catch (error) {
    console.error('Government contract error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit government contract',
      error: error.message
    });
  }
});

/**
 * GET /api/partnerships/government/contracts
 * Get government contract pipeline
 */
router.get('/government/contracts', async (req, res) => {
  try {
    const contracts = await PartnershipRevenue.db.query(`
      SELECT 
        contract_type,
        status,
        COUNT(*) as contracts_count,
        SUM(amount) as total_value,
        AVG(amount) as avg_contract_value,
        MIN(created_at) as first_contract,
        MAX(updated_at) as latest_activity
      FROM partnership_revenue 
      WHERE revenue_category = 'government_contract'
      GROUP BY contract_type, status
      ORDER BY total_value DESC;
    `);
    
    res.json({
      success: true,
      message: 'Government contracts retrieved successfully',
      data: {
        contracts: contracts.rows,
        summary: {
          total_contracts: contracts.rows.reduce((sum, c) => sum + parseInt(c.contracts_count), 0),
          total_value: contracts.rows.reduce((sum, c) => sum + parseFloat(c.total_value), 0),
          avg_contract_size: contracts.rows.reduce((sum, c) => sum + parseFloat(c.avg_contract_value), 0) / contracts.rows.length
        }
      }
    });
  } catch (error) {
    console.error('Government contracts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve government contracts',
      error: error.message
    });
  }
});

// Academic Partnership Routes
/**
 * POST /api/partnerships/academic/partnership
 * Establish academic research partnership
 */
router.post('/academic/partnership', [
  body('institutionId').notEmpty(),
  body('partnershipType').isIn(['research_collaboration', 'student_training', 'faculty_development']),
  body('investmentAmount').isFloat({ min: 200000, max: 2000000 }),
  body('researchScope.focus').notEmpty(),
  body('researchScope.period').optional().isIn(['6 months', '12 months', '24 months', '36 months']),
  body('researchScope.publications').optional().isBoolean(),
  body('researchScope.data_sharing').optional().isIn(['none', 'anonymized', 'full'])
], validate, async (req, res) => {
  try {
    const result = await PartnershipService.establishAcademicPartnership(req.body);
    
    res.json({
      success: true,
      message: 'Academic partnership established successfully',
      data: result
    });
  } catch (error) {
    console.error('Academic partnership error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to establish academic partnership',
      error: error.message
    });
  }
});

/**
 * GET /api/partnerships/academic/partnerships
 * Get academic partnership portfolio
 */
router.get('/academic/partnerships', async (req, res) => {
  try {
    const partnerships = await PartnershipRevenue.db.query(`
      SELECT 
        partnership_type,
        status,
        COUNT(*) as partnerships,
        SUM(amount) as total_investment,
        AVG(amount) as avg_investment,
        MIN(created_at) as partnership_start,
        research_scope
      FROM partnership_revenue 
      WHERE revenue_category = 'academic_research'
      GROUP BY partnership_type, status, research_scope
      ORDER BY total_investment DESC;
    `);
    
    res.json({
      success: true,
      message: 'Academic partnerships retrieved successfully',
      data: {
        partnerships: partnerships.rows,
        summary: {
          total_institutions: partnerships.rows.length,
          total_investment: partnerships.rows.reduce((sum, p) => sum + parseFloat(p.total_investment), 0),
          avg_partnership_value: partnerships.rows.reduce((sum, p) => sum + parseFloat(p.avg_investment), 0) / partnerships.rows.length
        }
      }
    });
  } catch (error) {
    console.error('Academic partnerships error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve academic partnerships',
      error: error.message
    });
  }
});

// Dashboard and Analytics Routes
/**
 * GET /api/partnerships/dashboard
 * Get comprehensive partnership dashboard
 */
router.get('/dashboard', [
  query('timeframe').optional().isIn(['7d', '30d', '90d', '1y'])
], validate, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dashboard = await PartnershipService.getPartnershipDashboard(timeframe);
    
    res.json({
      success: true,
      message: 'Partnership dashboard retrieved successfully',
      data: dashboard
    });
  } catch (error) {
    console.error('Partnership dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve partnership dashboard',
      error: error.message
    });
  }
});

/**
 * GET /api/partnerships/revenue/projections
 * Get revenue projections for next 12 months
 */
router.get('/revenue/projections', async (req, res) => {
  try {
    const projections = await PartnershipRevenue.projectRevenue(null, 365);
    const optimization = await PartnershipService.optimizePartnershipRevenue();
    
    res.json({
      success: true,
      message: 'Revenue projections retrieved successfully',
      data: {
        projections,
        optimization_opportunities: optimization
      }
    });
  } catch (error) {
    console.error('Revenue projections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve revenue projections',
      error: error.message
    });
  }
});

module.exports = router;