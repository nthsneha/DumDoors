# DumDoors Frontend

This directory contains the React frontend application for DumDoors, built for Reddit's Devvit platform.

## Structure

```
frontend/
├── src/                    # React source code
│   ├── client/            # Client-side React components
│   ├── server/            # Server-side code (Express -> Go migration)
│   └── shared/            # Shared types and utilities
├── assets/                # Static assets (images, icons, etc.)
├── dist/                  # Build output directory
├── node_modules/          # Frontend dependencies
├── package.json           # Frontend dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── eslint.config.js       # ESLint configuration
└── .prettierrc           # Prettier formatting configuration
```

## Development

To work with the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Build

To build the frontend for production:

```bash
cd frontend
npm run build
```

## Integration

The frontend integrates with:
- **Go Backend**: Located in `../backend/` - handles game logic, WebSocket connections, and API routes
- **AI Service**: Located in `../ai-service/` - handles door generation and response scoring
- **Devvit Platform**: Configured via `../devvit.json` with paths pointing to this frontend directory

## Migration Status

The frontend is currently being migrated from Express to Go backend:
- ✅ Frontend code organized in dedicated directory
- ✅ Devvit configuration updated for new paths
- 🔄 Server-side logic being migrated to Go backend
- 🔄 WebSocket integration being updated