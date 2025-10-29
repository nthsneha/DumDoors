#!/bin/bash

# Script to expose local backend using Cloudflare Tunnel

echo "🌐 Exposing DumDoors backend using Cloudflare Tunnel..."

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

echo "🚀 Starting Cloudflare tunnel for backend (port 8080)..."
echo "📋 Your backend will be available at a public URL"
echo "🔗 Copy the HTTPS URL and update your frontend configuration"
echo ""
echo "Press Ctrl+C to stop the tunnel"

# Start cloudflare tunnel (no login required for temporary tunnels)
cloudflared tunnel --url http://localhost:8080