# DumDoors- Multiplayer AI Decision Game

A fun party multiplayer game where players face AI-generated scenarios and make decisions that dynamically shape their path to victory.

## Game Concept

Players encounter "doors" (decision scenario/nodes) and describe their solutions. An AI scores their creativity, logic and entertainment value. Better scores = shorter paths to win!

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Service    │
│   (SvelteKit)   │◄──►│   (Go)          │◄──►│   (FastAPI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └──────────────┬────────┴───────────────────────┘
                        │
                ┌───────▼───────┐
                │   Databases   │
                │ Neo4j + Postgres │
                └───────────────┘
```

## Quick Start

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start Services**
   ```bash
   docker-compose up --build
   ```

3. **Access Services**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - AI Service: http://localhost:8000
   - Neo4j Browser: http://localhost:7474

## Project Structure

```
doors-game/
├── backend/          # Go backend (WebSocket + REST API)
├── ai-service/       # Python AI microservice (FastAPI)
├── frontend/         # SvelteKit frontend
├── neo4j/           # Graph database setup
├── postgres/        # SQL migrations
└── docker-compose.yml
```

## Tech Stack

- **Frontend**: SvelteKit + TailwindCSS
- **Backend**: Go + Fiber
- **AI Service**: Python + FastAPI  
- **Databases**: Neo4j (graph) + PostgreSQL (relational)
- **Infrastructure**: Docker Compose

## Game Features (Planned)

- Real-time multiplayer via WebSocket
- AI-driven decision scoring with personality
- Dynamic path generation (2-20 doors based on performance)
- Character cards based on decision patterns
- Themed scenarios (Corporate, Horror, Sci-fi, etc.)
- Leaderboards and player statistics

## Development Status

**This is a base repository structure** - implementation coming soon!

Current state: Folder structure and configuration placeholders ready for development.

## 🤝 Contributing

This project is in early development. Check back soon for contribution guidelines!

---

*Built with ❤️ by sneha and sai*
