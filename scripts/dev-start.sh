#!/bin/bash

# DumDoors Development Services Start Script

set -e

echo "🚀 Starting DumDoors development services..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run ./scripts/dev-setup.sh first."
    exit 1
fi

# Start databases first
echo "🗄️  Starting databases..."
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb neo4j redis

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 20

# Start application services
echo "🔧 Starting application services..."
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-services up -d backend ai-service

echo "📊 Service status:"
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps

echo ""
echo "🎉 Development services started successfully!"
echo ""
echo "📋 Available services:"
echo "   - Backend API: http://localhost:8080"
echo "   - AI Service: http://localhost:8000"
echo "   - MongoDB: localhost:27017"
echo "   - Neo4j: http://localhost:7474"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 To view logs:"
echo "   - Backend: docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend"
echo "   - AI Service: docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f ai-service"
echo ""
echo "🛑 To stop services: ./scripts/dev-stop.sh"