#!/bin/bash

# DumDoors Development Environment Setup Script

set -e

echo "🚀 Setting up DumDoors development environment..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please update it with your configuration."
else
    echo "✅ .env file already exists."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p database/mongo-dev-data
mkdir -p database/neo4j-dev-data
mkdir -p logs
mkdir -p tmp

# Set permissions for scripts
chmod +x scripts/*.sh
chmod +x backend/wait-for-it.sh

echo "🐳 Starting development databases..."
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongodb neo4j redis

echo "⏳ Waiting for databases to be ready..."
sleep 30

# Check database health
echo "🔍 Checking database connections..."
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec mongodb mongosh --eval "db.adminCommand('ping')" || echo "⚠️  MongoDB not ready yet"
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec neo4j cypher-shell -u neo4j -p password "RETURN 1" || echo "⚠️  Neo4j not ready yet"
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec redis redis-cli ping || echo "⚠️  Redis not ready yet"

echo "🎉 Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your .env file with the correct configuration"
echo "2. Run 'npm install' in the frontend directory"
echo "3. Run './scripts/dev-start.sh' to start all services"
echo "4. Run './scripts/dev-tools.sh' to start development tools (optional)"
echo ""
echo "🔗 Development URLs:"
echo "   - Backend API: http://localhost:8080"
echo "   - AI Service: http://localhost:8000"
echo "   - MongoDB Express: http://localhost:8081 (with dev-tools)"
echo "   - Redis Commander: http://localhost:8082 (with dev-tools)"
echo "   - Neo4j Browser: http://localhost:7474"