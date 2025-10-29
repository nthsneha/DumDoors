#!/bin/bash

# Script to set up Cloudflare Tunnel for DumDoors backend

echo "🌐 Setting up Cloudflare Tunnel for DumDoors backend..."

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📥 Installing cloudflared..."
    
    # Download and install cloudflared
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared-linux-amd64.deb
    rm cloudflared-linux-amd64.deb
    
    echo "✅ cloudflared installed!"
fi

# Check if backend is running
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ Backend is not running on localhost:8080"
    echo "Please start the backend first with: sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend"
    exit 1
fi

echo "🔑 Please follow these steps:"
echo "1. Go to https://dash.cloudflare.com/"
echo "2. Sign up/login to Cloudflare (free account)"
echo "3. Go to Zero Trust > Access > Tunnels"
echo "4. Create a new tunnel and copy the token"
echo "5. Run: cloudflared tunnel --token YOUR_TOKEN"
echo ""
echo "Or run this command to authenticate:"
echo "cloudflared tunnel login"
echo ""
echo "Then create and run a tunnel:"
echo "cloudflared tunnel create dumdoors-backend"
echo "cloudflared tunnel route dns dumdoors-backend dumdoors-api.yourdomain.com"
echo "cloudflared tunnel run dumdoors-backend"