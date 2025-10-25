# DumDoors - Multiplayer AI Decision Game

A multiplayer AI decision game built on Reddit's Devvit platform where players solve creative scenarios and their responses are scored by AI to determine their path through the game.

## Game Concept

Players encounter "doors" (decision scenarios/nodes) and describe their solutions. An AI scores their creativity, logic and entertainment value. Better scores = shorter paths to win!

## Technology Stack

- [Devvit](https://developers.reddit.com/): Reddit's developer platform for immersive games
- [React](https://react.dev/) + [Vite](https://vite.dev/): Frontend UI and build system
- [Go](https://golang.org/) + [Fiber](https://gofiber.io/): High-performance backend API
- [MongoDB](https://www.mongodb.com/): Game sessions and player data
- [Neo4j](https://neo4j.com/): Door relationships and player paths
- [Redis](https://redis.io/): Caching and session management
- [Python](https://python.org/): AI service for door generation and scoring
- [Tailwind CSS](https://tailwindcss.com/): Styling
- [TypeScript](https://www.typescriptlang.org/): Type safety

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Service    │
│   (React)       │◄──►│   (Go)          │◄──►│   (Python)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └──────────────┬────────┴───────────────────────┘
                        │
                ┌───────▼───────┐
                │   Databases   │
                │ MongoDB + Neo4j + Redis │
                └───────────────┘
```

## Repository Structure

```
dumdoors/
├── frontend/              # React frontend application
│   ├── src/              # React source code
│   ├── assets/           # Static assets
│   └── dist/             # Build output
├── backend/              # Go backend service
│   ├── internal/         # Internal Go packages
│   └── main.go           # Server entry point
├── ai-service/           # Python AI microservice
├── database/             # Database initialization scripts
├── tools/                # Development tools and scripts
└── devvit.json          # Devvit platform configuration
```

## Getting Started

### Prerequisites
- Node.js 22+
- Go 1.21+
- Python 3.11+
- Docker & Docker Compose (for databases)

### Development Setup

1. **Clone and setup the project:**
   ```bash
   git clone https://github.com/nthsneha/DumDoors.git
   cd DumDoors
   ```

2. **Start the databases:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
   ```

3. **Setup and run the Go backend:**
   ```bash
   cd backend
   go mod tidy
   go run main.go
   ```

4. **Setup and run the frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Setup and run the AI service:**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   python main.py
   ```

## Commands

### Frontend Commands (run from `frontend/` directory)
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run check`: Type check, lint, and format

### Backend Commands (run from `backend/` directory)
- `go run main.go`: Start the Go server
- `go build`: Build the backend binary
- `go test ./...`: Run tests

### Devvit Commands (run from root directory)
- `devvit upload`: Upload app to Reddit
- `devvit deploy`: Deploy to production
- `devvit logs`: View application logs

## Game Features

- ✅ Real-time multiplayer via WebSocket
- ✅ AI-driven decision scoring with personality
- ✅ Dynamic path generation (2-20 doors based on performance)
- ✅ Character cards based on decision patterns
- ✅ Themed scenarios (Corporate, Horror, Sci-fi, etc.)
- ✅ Leaderboards and player statistics
- ✅ Reddit Devvit platform integration

## Development Status

**Active Development** - Core backend infrastructure and Devvit integration complete!

Current state: 
- ✅ Go backend with MongoDB, Neo4j, and Redis integration
- ✅ Devvit platform integration
- ✅ Repository structure organized
- 🔄 Frontend migration to new structure
- 🔄 AI service implementation
- 🔄 WebSocket real-time features

## Cursor Integration

This template comes with a pre-configured cursor environment. To get started, [download cursor](https://www.cursor.com/downloads) and enable the `devvit-mcp` when prompted.

## 🤝 Contributing

This project is actively being developed. Feel free to contribute!

---

*Built with ❤️ by sneha and sai*