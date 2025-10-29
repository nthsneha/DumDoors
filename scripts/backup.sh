#!/bin/bash

# DumDoors Production Backup Script

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# AWS S3 Configuration (optional)
S3_BUCKET=${BACKUP_S3_BUCKET:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "🗄️  Starting DumDoors backup at $(date)"

# MongoDB Backup
echo "📦 Backing up MongoDB..."
MONGO_BACKUP_DIR="$BACKUP_DIR/mongodb_$TIMESTAMP"
mkdir -p "$MONGO_BACKUP_DIR"

docker-compose exec -T mongodb mongodump \
  --username="$MONGO_ROOT_USERNAME" \
  --password="$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase=admin \
  --db="$MONGO_DATABASE" \
  --out=/tmp/backup

docker cp dumdoors-mongodb:/tmp/backup "$MONGO_BACKUP_DIR/"
tar -czf "$BACKUP_DIR/mongodb_$TIMESTAMP.tar.gz" -C "$MONGO_BACKUP_DIR" .
rm -rf "$MONGO_BACKUP_DIR"

echo "✅ MongoDB backup completed: mongodb_$TIMESTAMP.tar.gz"

# Neo4j Backup
echo "📦 Backing up Neo4j..."
NEO4J_BACKUP_DIR="$BACKUP_DIR/neo4j_$TIMESTAMP"
mkdir -p "$NEO4J_BACKUP_DIR"

# Export Neo4j data
docker-compose exec -T neo4j cypher-shell \
  -u "$NEO4J_USERNAME" \
  -p "$NEO4J_PASSWORD" \
  "CALL apoc.export.cypher.all('/tmp/backup/neo4j_export.cypher', {format: 'cypher-shell'})"

docker cp dumdoors-neo4j:/tmp/backup "$NEO4J_BACKUP_DIR/"
tar -czf "$BACKUP_DIR/neo4j_$TIMESTAMP.tar.gz" -C "$NEO4J_BACKUP_DIR" .
rm -rf "$NEO4J_BACKUP_DIR"

echo "✅ Neo4j backup completed: neo4j_$TIMESTAMP.tar.gz"

# Redis Backup
echo "📦 Backing up Redis..."
docker-compose exec -T redis redis-cli --rdb /tmp/dump.rdb
docker cp dumdoors-redis:/tmp/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

echo "✅ Redis backup completed: redis_$TIMESTAMP.rdb"

# Application Configuration Backup
echo "📦 Backing up application configuration..."
CONFIG_BACKUP_DIR="$BACKUP_DIR/config_$TIMESTAMP"
mkdir -p "$CONFIG_BACKUP_DIR"

cp -r config "$CONFIG_BACKUP_DIR/"
cp .env.production "$CONFIG_BACKUP_DIR/"
cp docker-compose.yml "$CONFIG_BACKUP_DIR/"
cp docker-compose.prod.yml "$CONFIG_BACKUP_DIR/"

tar -czf "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" -C "$CONFIG_BACKUP_DIR" .
rm -rf "$CONFIG_BACKUP_DIR"

echo "✅ Configuration backup completed: config_$TIMESTAMP.tar.gz"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
  echo "☁️  Uploading backups to S3..."
  
  aws s3 cp "$BACKUP_DIR/mongodb_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/mongodb/" --region "$AWS_REGION"
  aws s3 cp "$BACKUP_DIR/neo4j_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/neo4j/" --region "$AWS_REGION"
  aws s3 cp "$BACKUP_DIR/redis_$TIMESTAMP.rdb" "s3://$S3_BUCKET/redis/" --region "$AWS_REGION"
  aws s3 cp "$BACKUP_DIR/config_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/config/" --region "$AWS_REGION"
  
  echo "✅ Backups uploaded to S3"
fi

# Clean up old local backups
echo "🧹 Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "*.tar.gz" -o -name "*.rdb" | \
  xargs ls -t | \
  tail -n +$((RETENTION_DAYS * 4 + 1)) | \
  xargs rm -f

# Clean up old S3 backups if configured
if [ -n "$S3_BUCKET" ]; then
  echo "🧹 Cleaning up old S3 backups..."
  
  # This would require additional AWS CLI commands to list and delete old objects
  # Implementation depends on specific S3 lifecycle policies
fi

echo "✅ Backup process completed successfully at $(date)"
echo "📊 Backup summary:"
ls -lh "$BACKUP_DIR"/*"$TIMESTAMP"*