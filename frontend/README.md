# Frontend — React, Tailwind CSS, Lucide & Web Audio API

This folder contains the complete client-side application for **Tic-Tac-Toe Arena**.

## Technologies Used
- **React 19** & **TypeScript**: Component-based UI with reactive state management
- **Tailwind CSS v4**: Dark cyber-gaming aesthetic with cyan and magenta glowing accents
- **Socket.IO Client**: Real-time event-driven connection to the Express backend
- **Web Audio API**: Synthesized in-browser sound effects (moves, victories, defeats, clicks) with zero external MP3 assets
- **Canvas Confetti**: Victory celebration animations

## Directory Structure
```text
frontend/
├── components/
│   ├── HandshakeGuideModal.tsx  # Project submission guide, test checklist, Render guide
│   └── LeaderboardModal.tsx     # MongoDB Live Leaderboard & Recent Match History viewer
├── utils/
│   ├── audio.ts                 # Web Audio API retro-modern sound synthesizer
│   └── aiBot.ts                 # Minimax AI algorithm for single-player practice
├── App.tsx                      # Master game interface (Online 2P, Pass & Play, AI Bot)
├── index.css                    # Tailwind CSS configuration
└── main.tsx                     # React DOM mount point
```
