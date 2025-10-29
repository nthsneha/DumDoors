#!/bin/bash

# Quick Railway deployment script

echo "🚀 Deploying DumDoors backend to Railway..."

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📥 Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo "🔑 Please login to Railway (free account):"
echo "1. Go to https://railway.app and sign up"
echo "2. Run: railway login"
echo "3. Run: railway init"
echo "4. Run: railway up"

echo ""
echo "Your backend will be deployed to a permanent URL like:"
echo "https://your-app-name.railway.app"