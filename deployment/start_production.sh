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
