#!/bin/bash

# DumDoors Production Deployment Script

set -e

# Configuration
ENVIRONMENT=${1:-"production"}
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-"true"}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}

echo "🚀 Starting DumDoors deployment to $ENVIRONMENT environment..."

# Validate environment
if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
  echo "❌ Invalid environment: $ENVIRONMENT. Use 'production' or 'staging'"
  exit 1
fi

# Check if required files exist
if [ ! -f ".env.$ENVIRONMENT" ]; then
  echo "❌ Environment file .env.$ENVIRONMENT not found"
  exit 1
fi

if [ ! -f "docker-compose.yml" ] || [ ! -f "docker-compose.prod.yml" ]; then
  echo "❌ Docker Compose files not found"
  exit 1
fi

# Load environment variables
export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)

# Pre-deployment backup
if [ "$BACKUP_BEFORE_DEPLOY" = "true" ]; then
  echo "💾 Creating pre-deployment backup..."
  ./scripts/backup.sh || echo "⚠️  Backup failed, continuing with deployment"
fi

# Pull latest images
echo "📥 Pulling latest Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull

# Build application images
echo "🔨 Building application images..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# Stop existing services (rolling deployment)
echo "🔄 Performing rolling deployment..."

# Deploy databases first (if not already running)
echo "🗄️  Ensuring databases are running..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d mongodb neo4j redis

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 30

# Health check databases
echo "🔍 Checking database health..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec mongodb mongosh --eval "db.adminCommand('ping')" || {
  echo "❌ MongoDB health check failed"
  exit 1
}

docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec neo4j cypher-shell -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" "RETURN 1" || {
  echo "❌ Neo4j health check failed"
  exit 1
}

docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec redis redis-cli -a "$REDIS_PASSWORD" ping || {
  echo "❌ Redis health check failed"
  exit 1
}

echo "✅ Databases are healthy"

# Deploy application services
echo "🔧 Deploying application services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend ai-service

# Deploy monitoring (if enabled)
if docker-compose -f docker-compose.yml -f docker-compose.prod.yml config --services | grep -q prometheus; then
  echo "📊 Deploying monitoring services..."
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring up -d
fi

# Deploy proxy (if enabled)
if docker-compose -f docker-compose.yml -f docker-compose.prod.yml config --services | grep -q nginx; then
  echo "🌐 Deploying reverse proxy..."
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml --profile proxy up -d
fi

# Health check application services
echo "🔍 Performing health checks..."
HEALTH_CHECK_START=$(date +%s)

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - HEALTH_CHECK_START))
  
  if [ $ELAPSED -gt $HEALTH_CHECK_TIMEOUT ]; then
    echo "❌ Health check timeout after ${HEALTH_CHECK_TIMEOUT}s"
    echo "📋 Service status:"
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
    exit 1
  fi
  
  # Check backend health
  if curl -f -s "http://localhost:${BACKEND_PORT:-8080}/health" > /dev/null; then
    echo "✅ Backend is healthy"
    break
  fi
  
  echo "⏳ Waiting for backend to be ready... (${ELAPSED}s/${HEALTH_CHECK_TIMEOUT}s)"
  sleep 10
done

# Check AI service health
while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - HEALTH_CHECK_START))
  
  if [ $ELAPSED -gt $HEALTH_CHECK_TIMEOUT ]; then
    echo "❌ AI Service health check timeout"
    exit 1
  fi
  
  if curl -f -s "http://localhost:${AI_SERVICE_PORT:-8000}/health" > /dev/null; then
    echo "✅ AI Service is healthy"
    break
  fi
  
  echo "⏳ Waiting for AI service to be ready... (${ELAPSED}s/${HEALTH_CHECK_TIMEOUT}s)"
  sleep 10
done

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

# Display deployment summary
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo ""
echo "🔗 Service URLs:"
echo "   - Backend API: http://localhost:${BACKEND_PORT:-8080}"
echo "   - AI Service: http://localhost:${AI_SERVICE_PORT:-8000}"
if [ -n "$PROMETHEUS_PORT" ]; then
  echo "   - Prometheus: http://localhost:${PROMETHEUS_PORT:-9090}"
fi
if [ -n "$GRAFANA_PORT" ]; then
  echo "   - Grafana: http://localhost:${GRAFANA_PORT:-3000}"
fi

echo ""
echo "📝 Post-deployment checklist:"
echo "   - [ ] Verify all services are running"
echo "   - [ ] Check application logs"
echo "   - [ ] Run smoke tests"
echo "   - [ ] Monitor performance metrics"
echo "   - [ ] Update DNS/load balancer if needed"

echo ""
echo "📋 Useful commands:"
echo "   - View logs: ./scripts/dev-logs.sh [service]"
echo "   - Monitor services: docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps"
echo "   - Scale services: docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale backend=3"