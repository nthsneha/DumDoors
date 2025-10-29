#!/bin/bash

# DumDoors Development Logs Script

set -e

SERVICE=${1:-"all"}

echo "📋 Viewing logs for: $SERVICE"

case $SERVICE in
    "backend")
        sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend
        ;;
    "ai-service")
        sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f ai-service
        ;;
    "mongodb")
        sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f mongodb
        ;;
    "neo4j")
        sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f neo4j
        ;;
    "redis")
        sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f redis
        ;;
    "all")
        sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
        ;;
    *)
        echo "❌ Unknown service: $SERVICE"
        echo "Available services: backend, ai-service, mongodb, neo4j, redis, all"
        exit 1
        ;;
esac