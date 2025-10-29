# DumDoors Development Guide

This guide provides comprehensive instructions for setting up and running the DumDoors game in a development environment.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)
- Node.js (version 18 or higher) for frontend development
- Git

## Quick Start

1. **Clone and setup the environment:**
   ```bash
   git clone <repository-url>
   cd dumdoors
   chmod +x scripts/*.sh
   ./scripts/dev-setup.sh
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development services:**
   ```bash
   ./scripts/dev-start.sh
   ```

4. **Start development tools (optional):**
   ```bash
   ./scripts/dev-tools.sh
   ```

## Architecture Overview

The DumDoors development environment consists of:

### Core Services
- **Backend (Go)**: Game logic, WebSocket handling, API endpoints
- **AI Service (Python)**: Door generation and response scoring
- **Frontend (React)**: User interface (runs separately via npm/yarn)

### Databases
- **MongoDB**: Game sessions, player data, responses
- **Neo4j**: Door relationships and player paths
- **Redis**: Caching and session management

### Development Tools
- **MongoDB Express**: Database administration UI
- **Redis Commander**: Redis data visualization
- **Neo4j Browser**: Graph database interface

## Development Workflow

### Starting Services

```bash
# Setup (first time only)
./scripts/dev-setup.sh

# Start core services
./scripts/dev-start.sh

# Start development tools
./scripts/dev-tools.sh

# View logs
./scripts/dev-logs.sh [service-name]
```

### Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:8080 | - |
| AI Service | http://localhost:8000 | - |
| MongoDB Express | http://localhost:8081 | admin/password |
| Redis Commander | http://localhost:8082 | - |
| Neo4j Browser | http://localhost:7474 | neo4j/password |

### Frontend Development

The frontend runs separately from Docker:

```bash
cd frontend
npm install
npm run dev
```

## Configuration

### Environment Variables

Key environment variables in `.env`:

```bash
# Database Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password
MONGO_DATABASE=dumdoors

NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password

REDIS_PASSWORD=password

# Service Configuration
BACKEND_PORT=8080
AI_SERVICE_PORT=8000

# AI Configuration
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_MODEL_PROVIDER=openai

# Development
LOG_LEVEL=debug
GIN_MODE=debug
```

### Docker Compose Profiles

The development setup uses Docker Compose profiles:

- **Default**: Databases only (mongodb, neo4j, redis)
- **dev-services**: Application services with hot reload
- **dev-tools**: Development administration tools

```bash
# Start only databases
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Start with application services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-services up -d

# Start with development tools
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-tools up -d
```

## Database Management

### MongoDB

**Connection**: `mongodb://admin:password@localhost:27017/dumdoors`

**Collections**:
- `game_sessions`: Active and completed game sessions
- `doors`: Door scenarios and metadata
- `player_responses`: Player submissions and scores
- `leaderboard`: Player statistics and rankings

**Development Data**: Seed data is automatically loaded from `database/mongo-dev-data/`

### Neo4j

**Connection**: `bolt://localhost:7687` (neo4j/password)

**Graph Structure**:
- `Door` nodes: Individual scenarios
- `Path` nodes: Game progression routes
- `Player` nodes: Player state and position
- Relationships: `LEADS_TO`, `CONTAINS`, `CURRENTLY_AT`

**Development Data**: Seed data loaded from `database/neo4j-dev-data/`

### Redis

**Connection**: `redis://localhost:6379` (password: password)

**Usage**:
- Session caching
- Door content caching
- Real-time game state
- WebSocket connection management

## Hot Reloading

### Backend (Go)
Uses [Air](https://github.com/cosmtrek/air) for automatic recompilation:
- Watches `.go` files
- Rebuilds on changes
- Configuration in `.air.toml`

### AI Service (Python)
Uses Uvicorn's `--reload` flag:
- Watches `.py` files
- Restarts on changes
- Debug logging enabled

### Frontend (React)
Uses Vite's development server:
- Hot module replacement
- Instant updates
- Source maps enabled

## Debugging

### Viewing Logs

```bash
# All services
./scripts/dev-logs.sh

# Specific service
./scripts/dev-logs.sh backend
./scripts/dev-logs.sh ai-service
./scripts/dev-logs.sh mongodb
```

### Database Access

```bash
# MongoDB shell
docker-compose exec mongodb mongosh -u admin -p password dumdoors

# Neo4j shell
docker-compose exec neo4j cypher-shell -u neo4j -p password

# Redis CLI
docker-compose exec redis redis-cli -a password
```

### Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Manual health check
curl http://localhost:8080/health
curl http://localhost:8000/health
```

## Testing

### Running Tests

```bash
# Backend tests
cd backend
go test ./...

# AI Service tests
cd ai-service
python -m pytest

# Frontend tests
cd frontend
npm test
```

### Test Data

Development seed data includes:
- Sample doors with various themes and difficulties
- Test game sessions
- Mock player responses
- Leaderboard entries

## Troubleshooting

### Common Issues

1. **Port conflicts**: Check if ports 8080, 8000, 27017, 7474, 7687, 6379 are available
2. **Database connection failures**: Ensure databases are fully started before application services
3. **Permission errors**: Run `chmod +x scripts/*.sh` to make scripts executable
4. **Docker issues**: Try `docker system prune` to clean up resources

### Reset Environment

```bash
# Stop all services and remove data
docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v

# Clean Docker system
docker system prune -f

# Restart setup
./scripts/dev-setup.sh
```

### Performance Optimization

For better development performance:

1. **Increase Docker resources**: Allocate more CPU/memory to Docker
2. **Use volume caching**: Volumes are configured with `:cached` flag
3. **Disable unnecessary services**: Comment out unused services in docker-compose files

## Production Differences

Key differences between development and production:

| Aspect | Development | Production |
|--------|-------------|------------|
| Build target | `development` | `production` |
| Hot reload | Enabled | Disabled |
| Logging | Debug level | Info level |
| Database persistence | Volumes | External storage |
| Security | Relaxed | Hardened |
| Monitoring | Basic | Comprehensive |

## Contributing

1. **Code Style**: Follow existing patterns and linting rules
2. **Testing**: Add tests for new features
3. **Documentation**: Update this guide for new setup requirements
4. **Database Changes**: Include migration scripts
5. **Environment**: Test changes in clean development environment

## Support

For development issues:
1. Check this documentation
2. Review service logs
3. Verify environment configuration
4. Test with clean Docker environment
5. Check GitHub issues for known problems