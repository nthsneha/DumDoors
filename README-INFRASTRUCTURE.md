# DumDoors Infrastructure Setup

This document describes the infrastructure setup for the DumDoors game transformation.

## Project Structure

```
dumdoors/
├── backend/                 # Go backend service
├── ai-service/             # Python AI service
├── database/               # Database initialization scripts
│   ├── mongo-init/        # MongoDB setup
│   └── neo4j-init/        # Neo4j setup
├── src/                   # Original Devvit frontend (React)
├── docker-compose.yml     # Production services
├── docker-compose.dev.yml # Development databases only
└── .env.example          # Environment variables template
```

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Development Mode (Databases Only)

For development, run only the databases while developing services locally:

```bash
# Start development databases
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# This starts:
# - MongoDB on port 27017
# - Neo4j on ports 7474 (HTTP) and 7687 (Bolt)
# - Redis on port 6379
```

### 3. Production Mode (All Services)

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

## Services

### MongoDB (Port 27017)
- **Purpose**: Game sessions, player data, doors, responses, leaderboard
- **Access**: `mongodb://admin:password@localhost:27017/dumdoors`
- **Admin UI**: Use MongoDB Compass or similar tool

### Neo4j (Ports 7474, 7687)
- **Purpose**: Door relationships and player paths
- **Web UI**: http://localhost:7474
- **Bolt**: bolt://localhost:7687
- **Credentials**: neo4j/password

### Redis (Port 6379)
- **Purpose**: Caching and session management
- **Access**: `redis://:password@localhost:6379`
- **CLI**: `redis-cli -a password`

### Go Backend (Port 8080)
- **Purpose**: Game logic, WebSocket connections, API routes
- **Health Check**: http://localhost:8080/health
- **API Docs**: http://localhost:8080/api/docs (when implemented)

### Python AI Service (Port 8000)
- **Purpose**: Door generation and response scoring
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs

## Database Initialization

### MongoDB
- Collections are created with validation schemas
- Indexes are set up for performance
- See `database/mongo-init/01-init-db.js`

### Neo4j
- Sample doors and relationships are created
- Constraints and indexes are established
- See `database/neo4j-init/init-graph.cypher`

## Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
REDIS_PASSWORD=password

# AI Service
OPENAI_API_KEY=your-openai-api-key
AI_MODEL_PROVIDER=openai

# Security
JWT_SECRET=your-jwt-secret
```

## Development Workflow

1. **Start databases**: `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
2. **Develop backend**: Work in `backend/` directory with Go
3. **Develop AI service**: Work in `ai-service/` directory with Python
4. **Test integration**: Use full docker-compose when ready

## Troubleshooting

### Database Connection Issues
```bash
# Check if containers are running
docker-compose ps

# View logs
docker-compose logs mongodb
docker-compose logs neo4j
docker-compose logs redis
```

### Reset Databases
```bash
# Stop and remove volumes
docker-compose down -v

# Restart with fresh data
docker-compose up -d
```

### Port Conflicts
If ports are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "27018:27017"  # Change MongoDB to port 27018
```

## Next Steps

After infrastructure setup:
1. Implement Go backend (Task 2)
2. Implement Python AI service (Task 5)
3. Update React frontend (Task 7)
4. Configure production deployment (Task 10)