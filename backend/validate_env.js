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
