# Backend — Node.js, Express.js, Socket.IO & MongoDB

This folder contains the complete server-authoritative backend for **Tic-Tac-Toe Arena**.

## Technologies Used
- **Node.js** & **Express.js**: REST API server, static file serving, health endpoints
- **Socket.IO**: Real-time bidirectional WebSockets for game rooms, turns, moves, and chat
- **MongoDB & Mongoose**: Persistent cloud database storing matches and player career stats

## Directory Structure
```text
backend/
├── config.ts              # Loads environment variables (PORT, MONGODB_URI)
├── db/
│   └── connect.ts         # Mongoose connection manager with reconnection & retry
├── models/
│   ├── Match.ts           # Schema for completed games (players, moves, winner, line)
│   └── PlayerStat.ts      # Schema for player leaderboard (wins, losses, win rate)
├── routes/
│   └── apiRoutes.ts       # REST endpoints (/api/health, /api/stats, /api/leaderboard, /api/matches)
├── socket/
│   └── gameSocket.ts      # Server-authoritative move validation & Socket.IO events
└── server.ts              # Backend application bootstrap
```

## MongoDB Database Configuration
- Connection string configured in `.env` as `MONGODB_URI`
- Provided URI: `mongodb+srv://shaikbushra569_db_user:bushu%4023@bushra.47criid.mongodb.net/tictactoe?appName=Bushra`
- Collections automatically created:
  - `matches`: Stores full match logs, final board state, moves count, winner
  - `playerstats`: Aggregates wins, losses, ties, total games, and win rates for the live leaderboard

## REST API Endpoints
- `GET /api/health` — Checks server and MongoDB connection status
- `GET /api/stats` — Returns active rooms, online players, total saved matches
- `GET /api/leaderboard` — Fetches top 20 players ranked by wins and win rate
- `GET /api/matches` — Returns recent match logs
- `GET /api/room/:code/exists` — Validates room code before joining
