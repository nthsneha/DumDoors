#!/bin/bash

# DumDoors Development Tools Start Script

set -e

echo "🔧 Starting DumDoors development tools..."

# Check if databases are running
if ! docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps mongodb | grep -q "Up"; then
    echo "❌ Databases are not running. Please run ./scripts/dev-start.sh first."
    exit 1
fi

# Start development tools
echo "🛠️  Starting development tools..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-tools up -d mongo-express redis-commander

echo "📊 Development tools status:"
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-tools ps

echo ""
echo "🎉 Development tools started successfully!"
echo ""
echo "🔗 Development tool URLs:"
echo "   - MongoDB Express: http://localhost:8081"
echo "     Username: admin, Password: password"
echo "   - Redis Commander: http://localhost:8082"
echo "   - Neo4j Browser: http://localhost:7474"
echo "     Username: neo4j, Password: password"
echo ""
echo "🛑 To stop tools: docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-tools down"