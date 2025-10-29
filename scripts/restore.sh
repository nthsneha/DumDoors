#!/bin/bash

# DumDoors Production Restore Script

set -e

# Configuration
BACKUP_DIR="/backups"
RESTORE_TIMESTAMP=${1:-""}

if [ -z "$RESTORE_TIMESTAMP" ]; then
  echo "❌ Usage: $0 <timestamp>"
  echo "Available backups:"
  ls -la "$BACKUP_DIR" | grep -E "(mongodb|neo4j|redis|config)_[0-9]{8}_[0-9]{6}"
  exit 1
fi

echo "🔄 Starting DumDoors restore from timestamp: $RESTORE_TIMESTAMP"

# Confirm restore operation
read -p "⚠️  This will overwrite existing data. Are you sure? (yes/no): " -r
if [[ ! $REPLY =~ ^yes$ ]]; then
  echo "❌ Restore cancelled"
  exit 1
fi

# Stop services
echo "🛑 Stopping services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# MongoDB Restore
if [ -f "$BACKUP_DIR/mongodb_$RESTORE_TIMESTAMP.tar.gz" ]; then
  echo "📦 Restoring MongoDB..."
  
  # Start only MongoDB
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d mongodb
  sleep 30
  
  # Extract backup
  TEMP_DIR="/tmp/restore_$RESTORE_TIMESTAMP"
  mkdir -p "$TEMP_DIR"
  tar -xzf "$BACKUP_DIR/mongodb_$RESTORE_TIMESTAMP.tar.gz" -C "$TEMP_DIR"
  
  # Copy to container and restore
  docker cp "$TEMP_DIR" dumdoors-mongodb:/tmp/restore
  docker-compose exec -T mongodb mongorestore \
    --username="$MONGO_ROOT_USERNAME" \
    --password="$MONGO_ROOT_PASSWORD" \
    --authenticationDatabase=admin \
    --drop \
    /tmp/restore/backup
  
  # Cleanup
  rm -rf "$TEMP_DIR"
  docker-compose exec mongodb rm -rf /tmp/restore
  
  echo "✅ MongoDB restore completed"
else
  echo "⚠️  MongoDB backup not found: mongodb_$RESTORE_TIMESTAMP.tar.gz"
fi

# Neo4j Restore
if [ -f "$BACKUP_DIR/neo4j_$RESTORE_TIMESTAMP.tar.gz" ]; then
  echo "📦 Restoring Neo4j..."
  
  # Start only Neo4j
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d neo4j
  sleep 30
  
  # Extract backup
  TEMP_DIR="/tmp/restore_neo4j_$RESTORE_TIMESTAMP"
  mkdir -p "$TEMP_DIR"
  tar -xzf "$BACKUP_DIR/neo4j_$RESTORE_TIMESTAMP.tar.gz" -C "$TEMP_DIR"
  
  # Clear existing data
  docker-compose exec -T neo4j cypher-shell \
    -u "$NEO4J_USERNAME" \
    -p "$NEO4J_PASSWORD" \
    "MATCH (n) DETACH DELETE n"
  
  # Copy and restore
  docker cp "$TEMP_DIR/backup/neo4j_export.cypher" dumdoors-neo4j:/tmp/restore.cypher
  docker-compose exec -T neo4j cypher-shell \
    -u "$NEO4J_USERNAME" \
    -p "$NEO4J_PASSWORD" \
    -f /tmp/restore.cypher
  
  # Cleanup
  rm -rf "$TEMP_DIR"
  docker-compose exec neo4j rm -f /tmp/restore.cypher
  
  echo "✅ Neo4j restore completed"
else
  echo "⚠️  Neo4j backup not found: neo4j_$RESTORE_TIMESTAMP.tar.gz"
fi

# Redis Restore
if [ -f "$BACKUP_DIR/redis_$RESTORE_TIMESTAMP.rdb" ]; then
  echo "📦 Restoring Redis..."
  
  # Start only Redis
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d redis
  sleep 10
  
  # Stop Redis, replace dump file, restart
  docker-compose stop redis
  docker cp "$BACKUP_DIR/redis_$RESTORE_TIMESTAMP.rdb" dumdoors-redis:/data/dump.rdb
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d redis
  
  echo "✅ Redis restore completed"
else
  echo "⚠️  Redis backup not found: redis_$RESTORE_TIMESTAMP.rdb"
fi

# Configuration Restore
if [ -f "$BACKUP_DIR/config_$RESTORE_TIMESTAMP.tar.gz" ]; then
  echo "📦 Restoring configuration..."
  
  # Backup current config
  cp -r config config.backup.$(date +%s) 2>/dev/null || true
  cp .env.production .env.production.backup.$(date +%s) 2>/dev/null || true
  
  # Extract and restore config
  TEMP_DIR="/tmp/restore_config_$RESTORE_TIMESTAMP"
  mkdir -p "$TEMP_DIR"
  tar -xzf "$BACKUP_DIR/config_$RESTORE_TIMESTAMP.tar.gz" -C "$TEMP_DIR"
  
  cp -r "$TEMP_DIR/config" .
  cp "$TEMP_DIR/.env.production" .
  
  # Cleanup
  rm -rf "$TEMP_DIR"
  
  echo "✅ Configuration restore completed"
else
  echo "⚠️  Configuration backup not found: config_$RESTORE_TIMESTAMP.tar.gz"
fi

# Start all services
echo "🚀 Starting all services..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 60

# Verify restore
echo "🔍 Verifying restore..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo "✅ Restore process completed successfully at $(date)"
echo "🔗 Services should be available at their configured endpoints"