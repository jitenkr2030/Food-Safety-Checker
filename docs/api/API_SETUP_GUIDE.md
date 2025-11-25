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

