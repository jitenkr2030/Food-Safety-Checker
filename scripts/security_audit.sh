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
