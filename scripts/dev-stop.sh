#!/bin/bash

# DumDoors Development Services Stop Script

set -e

echo "🛑 Stopping DumDoors development services..."

# Stop all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-services --profile dev-tools down

echo "🧹 Cleaning up..."

# Optional: Remove volumes (uncomment if you want to reset data)
# echo "⚠️  Removing all data volumes..."
# docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v

echo "✅ All services stopped successfully!"
echo ""
echo "💡 To start services again: ./scripts/dev-start.sh"
echo "💡 To reset all data: docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v"