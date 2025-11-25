#!/bin/bash

# Production Environment Setup Script
# Food Safety App - Complete Monetization System
# Author: MiniMax Agent
# Date: November 25, 2025

set -e  # Exit on any error

echo "🚀 Setting up production environment for Food Safety Monetization System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Step 1: Generate secure JWT secret
print_info "Step 1: Generating secure JWT secret..."
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
print_status "JWT secret generated securely"

# Step 2: Generate random database password
print_info "Step 2: Generating secure database password..."
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
print_status "Database password generated securely"

# Step 3: Generate Razorpay webhook secret
print_info "Step 3: Generating webhook secrets..."
RAZORPAY_WEBHOOK_SECRET=$(openssl rand -base64 32 | tr -d '\n')
STRIPE_WEBHOOK_SECRET=$(openssl rand -base64 32 | tr -d '\n')
print_status "Webhook secrets generated securely"

# Step 4: Update .env file
print_info "Step 4: Updating environment configuration..."
cat > backend/.env << EOF
# Food Safety App - Production Environment
# Generated on: $(date)
# Complete 7-Revenue Stream System

# Database Configuration
DATABASE_URL=postgresql://foodsafe_user:${DB_PASSWORD}@localhost:5432/foodsafe_db
DB_USER=foodsafe_user
DB_HOST=localhost
DB_NAME=foodsafe_db
DB_PASSWORD=${DB_PASSWORD}
DB_PORT=5432

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${DB_PASSWORD:0:16}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Server Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Razorpay Configuration (INDIAN MARKET)
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_secret_here
RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET}

# Stripe Configuration (INTERNATIONAL MARKET)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_here
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}

# Email Configuration (for notifications)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here

# File Upload Configuration
UPLOAD_MAX_SIZE=10mb
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Revenue Stream Configuration
# Subscription Plans (B2C)
SUBSCRIPTION_BASIC_PRICE=299
SUBSCRIPTION_PREMIUM_PRICE=599
SUBSCRIPTION_ENTERPRISE_PRICE=2999

# Partnership Commission Rates
ECOMMERCE_COMMISSION_MIN=3
ECOMMERCE_COMMISSION_MAX=8
DELIVERY_COMMISSION_MIN=1
DELIVERY_COMMISSION_MAX=2

# Healthcare Partnership Rates
HEALTHCARE_MIN_MONTHLY=10000
HEALTHCARE_MAX_MONTHLY=50000

# Research Report Pricing
RESEARCH_REPORT_MIN=25000
RESEARCH_REPORT_MAX=300000

# Government Contract Pricing
GOVT_CONTRACT_MIN=1000000
GOVT_CONTRACT_MAX=10000000

# Academic Partnership Pricing
ACADEMIC_MIN=200000
ACADEMIC_MAX=2000000

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_SECRET=${JWT_SECRET:0:32}

# Monitoring & Logging
LOG_LEVEL=info
ENABLE_METRICS=true
MONITORING_ENDPOINT=/metrics
EOF

print_status "Environment configuration updated with secure secrets"

# Step 5: Generate API key setup instructions
print_info "Step 5: Generating API setup instructions..."
cat > API_SETUP_GUIDE.md << 'EOF'
# API Keys Setup Guide

## 1. Razorpay Setup (Indian Market)

### Get Razorpay Credentials:
1. Visit https://dashboard.razorpay.com/
2. Sign up/Login to your account
3. Go to Settings > API Keys
4. Generate new API keys (test mode for development)
5. Copy Key ID and Key Secret

### Update .env:
```
RAZORPAY_KEY_ID=rzp_test_your_actual_key_id
RAZORPAY_KEY_SECRET=your_actual_razorpay_secret
```

### Set up Webhooks:
1. Go to Settings > Webhooks
2. Add webhook endpoint: https://yourdomain.com/api/webhooks/razorpay
3. Enable events: payment.captured, subscription.activated, subscription.cancelled
4. Use the generated webhook secret

## 2. Stripe Setup (International Market)

### Get Stripe Credentials:
1. Visit https://dashboard.stripe.com/
2. Sign up/Login to your account
3. Go to Developers > API Keys
4. Get Secret Key (test mode for development)
5. Get Publishable Key

### Update .env:
```
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_publishable
```

### Set up Webhooks:
1. Go to Developers > Webhooks
2. Add endpoint: https://yourdomain.com/api/webhooks/stripe
3. Enable events: invoice.payment_succeeded, customer.subscription.created
4. Use the generated webhook secret

## 3. Email Configuration (for notifications)

### Gmail Setup (Recommended):
1. Enable 2FA on your Gmail account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Select "Mail" and "Other (custom name)"
4. Enter "Food Safety App"
5. Copy the generated 16-character password

### Update .env:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-char-app-password
```

## 4. Database Setup

### PostgreSQL Installation:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database:
```sql
sudo -u postgres psql
CREATE USER foodsafe_user WITH PASSWORD 'your_password';
CREATE DATABASE foodsafe_db OWNER foodsafe_user;
GRANT ALL PRIVILEGES ON DATABASE foodsafe_db TO foodsafe_user;
\q
```

### Run Migration:
```bash
cd backend
psql -U foodsafe_user -d foodsafe_db -f database_migration.sql
```

## 5. Redis Setup

### Redis Installation:
```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis
```

## Security Checklist:
- [ ] All API keys are secure and not shared
- [ ] Webhook secrets are unique and secure
- [ ] Database passwords are strong
- [ ] JWT secret is 64+ characters
- [ ] Email app password is secure
- [ ] Environment file is not committed to git

EOF

print_status "API setup guide created"

# Step 6: Create deployment checklist
print_info "Step 6: Creating deployment checklist..."
cat > DEPLOYMENT_CHECKLIST.md << 'EOF'
# 🚀 Production Deployment Checklist

## Pre-Deployment Setup
- [ ] ✅ Secure environment variables generated
- [ ] ✅ API setup guide created
- [ ] Database credentials secured
- [ ] Payment gateway API keys obtained
- [ ] Email configuration completed
- [ ] Redis server installed and running
- [ ] PostgreSQL database created
- [ ] SSL certificate prepared (for HTTPS)

## Infrastructure Setup
- [ ] Cloud provider selected (AWS/Azure/GCP)
- [ ] Virtual machine/instance created
- [ ] Domain name configured
- [ ] DNS settings updated
- [ ] Firewall rules configured (ports 80, 443, 3000)
- [ ] SSL certificate installed

## Application Deployment
- [ ] Node.js installed (v18+)
- [ ] npm dependencies installed
- [ ] Database migration executed
- [ ] Environment variables configured
- [ ] Application started successfully
- [ ] Health check endpoint responding

## Payment Gateway Configuration
- [ ] Razorpay API keys configured
- [ ] Razorpay webhooks set up
- [ ] Stripe API keys configured
- [ ] Stripe webhooks set up
- [ ] Webhook endpoints publicly accessible

## Revenue Stream Testing
- [ ] Subscription creation tested (₹299, ₹599 plans)
- [ ] E-commerce commission calculation verified
- [ ] Delivery partnership tracking working
- [ ] Healthcare partnership setup functional
- [ ] Research report generation tested
- [ ] Government contract tracking ready
- [ ] Academic partnership system operational

## Monitoring & Security
- [ ] Application monitoring configured
- [ ] Error logging implemented
- [ ] Revenue tracking dashboard accessible
- [ ] API rate limiting active
- [ ] Security headers configured
- [ ] CORS settings appropriate

## Go-Live Steps
- [ ] All 7 revenue streams operational
- [ ] First test transactions processed
- [ ] Revenue calculations verified
- [ ] Customer support system ready
- [ ] Backup systems configured
- [ ] Disaster recovery plan tested

## Post-Deployment
- [ ] Performance monitoring active
- [ ] Revenue metrics tracking
- [ ] User onboarding flow tested
- [ ] Customer feedback collection ready
- [ ] Regular backup schedule set
- [ ] Security audits scheduled

## Revenue Targets
- [ ] Month 1: ₹50K revenue target
- [ ] Month 3: ₹5L revenue target
- [ ] Month 6: ₹25L revenue target
- [ ] Year 1: ₹4.2Cr revenue target
- [ ] Year 3: ₹125Cr revenue target

## Support & Maintenance
- [ ] Monitoring alerts configured
- [ ] Backup procedures documented
- [ ] Incident response plan ready
- [ ] Customer support documentation
- [ ] API documentation updated
- [ ] Team training completed

EOF

print_status "Deployment checklist created"

# Step 7: Create environment validation script
print_info "Step 7: Creating environment validation..."
cat > backend/validate_env.js << 'EOF'
const fs = require('fs');
const path = require('path');

class EnvironmentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.requiredKeys = [
            'DATABASE_URL',
            'JWT_SECRET',
            'RAZORPAY_KEY_ID',
            'RAZORPAY_KEY_SECRET',
            'STRIPE_SECRET_KEY',
            'STRIPE_PUBLISHABLE_KEY',
            'REDIS_URL'
        ];
        this.optionalKeys = [
            'EMAIL_USER',
            'EMAIL_PASS',
            'RAZORPAY_WEBHOOK_SECRET',
            'STRIPE_WEBHOOK_SECRET'
        ];
    }

    validate() {
        console.log('🔍 Validating production environment...\n');

        // Check if .env file exists
        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) {
            this.errors.push('❌ .env file not found');
            return false;
        }

        // Load environment variables
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                envVars[key] = valueParts.join('=');
            }
        });

        // Validate required keys
        this.requiredKeys.forEach(key => {
            if (!envVars[key]) {
                this.errors.push(`❌ Missing required environment variable: ${key}`);
            } else if (envVars[key].includes('your_') || envVars[key].includes('placeholder')) {
                this.errors.push(`❌ ${key} contains placeholder value, needs actual API key`);
            } else {
                console.log(`✅ ${key}: Configured`);
            }
        });

        // Validate optional keys
        this.optionalKeys.forEach(key => {
            if (!envVars[key]) {
                this.warnings.push(`⚠️  Optional ${key} not configured`);
            } else if (envVars[key].includes('your_') || envVars[key].includes('placeholder')) {
                this.warnings.push(`⚠️  ${key} contains placeholder value`);
            } else {
                console.log(`✅ ${key}: Configured`);
            }
        });

        // Validate specific requirements
        this.validateJWT(envVars.JWT_SECRET);
        this.validateRazorpay(envVars.RAZORPAY_KEY_ID, envVars.RAZORPAY_KEY_SECRET);
        this.validateStripe(envVars.STRIPE_SECRET_KEY, envVars.STRIPE_PUBLISHABLE_KEY);
        this.validateDatabase(envVars.DATABASE_URL);

        // Print results
        this.printResults();

        return this.errors.length === 0;
    }

    validateJWT(secret) {
        if (secret && secret.length < 32) {
            this.errors.push('❌ JWT_SECRET must be at least 32 characters');
        } else if (secret && secret.length >= 32) {
            console.log(`✅ JWT_SECRET: Strong (${secret.length} characters)`);
        }
    }

    validateRazorpay(keyId, keySecret) {
        if (keyId && keySecret) {
            if (keyId.startsWith('rzp_')) {
                console.log('✅ Razorpay: Valid key format');
            } else {
                this.warnings.push('⚠️  Razorpay key format may be incorrect');
            }
        }
    }

    validateStripe(secretKey, publishableKey) {
        if (secretKey && publishableKey) {
            if (secretKey.startsWith('sk_') && publishableKey.startsWith('pk_')) {
                console.log('✅ Stripe: Valid key format');
            } else {
                this.warnings.push('⚠️  Stripe key format may be incorrect');
            }
        }
    }

    validateDatabase(dbUrl) {
        if (dbUrl) {
            try {
                const url = new URL(dbUrl);
                console.log(`✅ Database: ${url.host} configured`);
            } catch (error) {
                this.errors.push('❌ Database URL format invalid');
            }
        }
    }

    printResults() {
        console.log('\n📊 Validation Results:');
        console.log('========================');
        
        if (this.errors.length === 0) {
            console.log('✅ All critical environment variables configured correctly');
        } else {
            console.log('\n❌ Errors (Must Fix):');
            this.errors.forEach(error => console.log(error));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings (Recommended):');
            this.warnings.forEach(warning => console.log(warning));
        }

        console.log('\n🚀 Next Steps:');
        if (this.errors.length === 0) {
            console.log('1. Install dependencies: npm install');
            console.log('2. Run database migration: npm run migrate');
            console.log('3. Start application: npm start');
            console.log('4. Test payment integration: npm run test-payments');
        } else {
            console.log('1. Fix all error items above');
            console.log('2. Update .env file with proper values');
            console.log('3. Run validation again: node validate_env.js');
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new EnvironmentValidator();
    const isValid = validator.validate();
    process.exit(isValid ? 0 : 1);
}

module.exports = EnvironmentValidator;
EOF

print_status "Environment validator created"

# Step 8: Create quick start script
print_info "Step 8: Creating quick start script..."
cat > start_production.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Food Safety Monetization System in Production..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Navigate to backend directory
cd backend

# Validate environment
echo "🔍 Validating environment..."
node validate_env.js
if [ $? -ne 0 ]; then
    echo "❌ Environment validation failed. Please fix errors and try again."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run database migration
echo "🗄️  Running database migration..."
npm run migrate

# Start the application
echo "🚀 Starting production server..."
npm start
EOF

chmod +x start_production.sh
print_status "Quick start script created"

# Step 9: Create security audit script
print_info "Step 9: Creating security audit script..."
cat > security_audit.sh << 'EOF'
#!/bin/bash

echo "🔒 Running Security Audit for Food Safety App..."

# Check file permissions
echo "📁 Checking file permissions..."
find . -name "*.env" -exec ls -la {} \; -print
echo ""

# Check for sensitive data in git
echo "🔍 Checking for sensitive data exposure..."
if [ -f .gitignore ]; then
    echo "✅ .gitignore exists"
    if grep -q "\.env" .gitignore; then
        echo "✅ .env is in .gitignore"
    else
        echo "❌ .env is NOT in .gitignore - ADD IT IMMEDIATELY!"
    fi
else
    echo "❌ No .gitignore found"
fi

# Check JWT secret strength
echo "🔐 Checking JWT secret strength..."
if [ -f backend/.env ]; then
    JWT_SECRET=$(grep "JWT_SECRET=" backend/.env | cut -d'=' -f2)
    if [ ${#JWT_SECRET} -gt 32 ]; then
        echo "✅ JWT secret is strong (${#JWT_SECRET} characters)"
    else
        echo "❌ JWT secret is too weak (${#JWT_SECRET} characters, need 32+)"
    fi
fi

# Check database password
echo "🗄️  Checking database password..."
if [ -f backend/.env ]; then
    DB_PASSWORD=$(grep "DB_PASSWORD=" backend/.env | cut -d'=' -f2)
    if [ ${#DB_PASSWORD} -gt 20 ]; then
        echo "✅ Database password is strong"
    else
        echo "⚠️  Database password might be weak"
    fi
fi

echo ""
echo "🛡️  Security Recommendations:"
echo "1. Never commit .env files to git"
echo "2. Use strong, unique passwords"
echo "3. Enable 2FA on all accounts"
echo "4. Regularly rotate API keys"
echo "5. Use HTTPS in production"
echo "6. Implement rate limiting"
echo "7. Regular security audits"
EOF

chmod +x security_audit.sh
print_status "Security audit script created"

# Final summary
echo ""
echo "🎉 Production setup completed successfully!"
echo ""
print_status "✅ Secure environment variables generated"
print_status "✅ API setup guide created (API_SETUP_GUIDE.md)"
print_status "✅ Deployment checklist created (DEPLOYMENT_CHECKLIST.md)"
print_status "✅ Environment validator created (backend/validate_env.js)"
print_status "✅ Quick start script created (start_production.sh)"
print_status "✅ Security audit script created (security_audit.sh)"
echo ""
echo "🚀 Next Steps:"
echo "1. 📖 Read API_SETUP_GUIDE.md to get your payment gateway API keys"
echo "2. 🗄️  Set up PostgreSQL and Redis databases"
echo "3. 🔧 Configure your payment gateways (Razorpay + Stripe)"
echo "4. ⚙️  Run: ./security_audit.sh to check your setup"
echo "5. 🚀 Run: ./start_production.sh to launch your revenue system"
echo ""
echo "💰 Ready to generate revenue from all 7 streams!"
echo "   - Subscriptions: ₹299-599/month"
echo "   - E-commerce: 3-8% commission"
echo "   - Delivery: ₹1-2/order"
echo "   - Healthcare: ₹10K-50K/month"
echo "   - Research: ₹25K-3L/report"
echo "   - Government: ₹10L-1Cr/contract"
echo "   - Academic: ₹2L-20L/partnership"
echo ""
echo "📞 Target: ₹125 Crore by Year 3!"

EOF