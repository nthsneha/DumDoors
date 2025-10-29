#!/bin/bash

# DumDoors Development Status Script

echo "📊 DumDoors Development Environment Status"
echo "=========================================="

# Check if services are running
echo "🔍 Checking service status..."
sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps

echo ""
echo "🌐 Available Services:"
echo "   - MongoDB: http://localhost:27017"
echo "   - Redis: http://localhost:6379"
echo "   - Neo4j Browser: http://localhost:7474 (neo4j/password)"
echo "   - MongoDB Express: http://localhost:8081 (admin/password)"
echo "   - Redis Commander: http://localhost:8082"

echo ""
echo "🛠️  Development Commands:"
echo "   - Start all services: ./scripts/dev-start.sh"
echo "   - Stop all services: ./scripts/dev-stop.sh"
echo "   - View logs: ./scripts/dev-logs.sh [service-name]"
echo "   - Test databases: ./test-databases.sh"

echo ""
echo "📝 Configuration:"
echo "   - Environment file: .env"
echo "   - Docker Compose: docker-compose.yml + docker-compose.dev.yml"
echo "   - Database init scripts: database/ directory"