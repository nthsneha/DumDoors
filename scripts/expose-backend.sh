#!/bin/bash

# Script to expose local backend using ngrok

echo "🌐 Exposing DumDoors backend to public URL..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "📥 Installing ngrok..."
    
    # Download and install ngrok
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
    echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
    sudo apt update && sudo apt install ngrok
    
    echo "✅ ngrok installed!"
    echo "🔑 Please sign up at https://ngrok.com and get your auth token"
    echo "Then run: ngrok config add-authtoken YOUR_TOKEN"
    echo "After that, run this script again."
    exit 1
fi

# Check if backend is running
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo "❌ Backend is not running on localhost:8080"
    echo "Please start the backend first with: sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend"
    exit 1
fi

echo "🚀 Starting ngrok tunnel for backend (port 8080)..."
echo "📋 Your backend will be available at a public URL"
echo "🔗 Copy the HTTPS URL and update your frontend configuration"
echo ""
echo "Press Ctrl+C to stop the tunnel"

# Start ngrok tunnel
ngrok http 8080