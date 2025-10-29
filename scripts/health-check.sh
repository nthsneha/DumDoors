#!/bin/bash

# DumDoors Health Check Script

set -e

# Configuration
BACKEND_URL=${BACKEND_URL:-"http://localhost:8080"}
AI_SERVICE_URL=${AI_SERVICE_URL:-"http://localhost:8000"}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}

echo "🔍 Performing DumDoors health checks..."

# Function to check service health
check_service() {
  local service_name=$1
  local url=$2
  local timeout=$3
  
  echo "Checking $service_name..."
  
  if curl -f -s --max-time "$timeout" "$url/health" > /dev/null; then
    echo "✅ $service_name is healthy"
    return 0
  else
    echo "❌ $service_name is unhealthy"
    return 1
  fi
}

# Check database connections
check_database() {
  local db_name=$1
  local check_command=$2
  
  echo "Checking $db_name..."
  
  if eval "$check_command" > /dev/null 2>&1; then
    echo "✅ $db_name is healthy"
    return 0
  else
    echo "❌ $db_name is unhealthy"
    return 1
  fi
}

# Initialize health status
OVERALL_HEALTH=0

# Check backend service
if ! check_service "Backend" "$BACKEND_URL" "$TIMEOUT"; then
  OVERALL_HEALTH=1
fi

# Check AI service
if ! check_service "AI Service" "$AI_SERVICE_URL" "$TIMEOUT"; then
  OVERALL_HEALTH=1
fi

# Check MongoDB
MONGO_CHECK="docker-compose exec -T mongodb mongosh --eval 'db.adminCommand(\"ping\")'"
if ! check_database "MongoDB" "$MONGO_CHECK"; then
  OVERALL_HEALTH=1
fi

# Check Neo4j
NEO4J_CHECK="docker-compose exec -T neo4j cypher-shell -u neo4j -p password 'RETURN 1'"
if ! check_database "Neo4j" "$NEO4J_CHECK"; then
  OVERALL_HEALTH=1
fi

# Check Redis
REDIS_CHECK="docker-compose exec -T redis redis-cli ping"
if ! check_database "Redis" "$REDIS_CHECK"; then
  OVERALL_HEALTH=1
fi

# Summary
echo ""
if [ $OVERALL_HEALTH -eq 0 ]; then
  echo "🎉 All services are healthy!"
else
  echo "⚠️  Some services are unhealthy. Check the logs for more details."
fi

echo ""
echo "📊 Service Status:"
docker-compose ps

exit $OVERALL_HEALTH