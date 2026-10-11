/**
 * Handshake Project: Create a Multiplayer Game
 * Backend: Node.js + Express.js + Socket.IO + MongoDB
 */
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://shaikbushra569_db_user:bushu%4023@bushra.47criid.mongodb.net/tictactoe?appName=Bushra';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(express.json());

// MongoDB Models
const MatchSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true },
    playerX: { id: String, name: String },
    playerO: { id: String, name: String },
    winner: String,
    winnerName: String,
    winningLine: [Number],
    board: [String],
    movesCount: Number,
  },
  { timestamps: true }
);

const PlayerStatSchema = new mongoose.Schema(
  {
    usernameLower: { type: String, unique: true },
    displayName: String,
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    lastPlayed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);
const PlayerStat = mongoose.models.PlayerStat || mongoose.model('PlayerStat', PlayerStatSchema);

let isDbConnected = false;
mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  .then(() => {
    isDbConnected = true;
    console.log('[MongoDB] Connected successfully to Atlas database!');
  })
  .catch((err) => {
    console.warn('[MongoDB] Fallback mode active (MongoDB connection error:', err.message, ')');
  });

// Static assets
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

app.use(express.static(staticDir));

// Game State
const rooms = new Map();
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board) {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

function sanitizeRoom(room) {
  return {
    id: room.id,
    players: Object.values(room.players),
    spectators: Object.values(room.spectators),
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    winningLine: room.winningLine,
    scores: room.scores,
    rematchVotes: room.rematchVotes,
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// REST endpoints
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', database: isDbConnected ? 'connected' : 'offline', timestamp: Date.now() })
);

app.get('/api/stats', async (req, res) => {
  let totalSavedMatches = 0;
  if (isDbConnected) {
    try {
      totalSavedMatches = await Match.countDocuments();
    } catch {}
  }
  let totalPlayers = 0;
  rooms.forEach((r) => {
    totalPlayers += Object.keys(r.players).length + Object.keys(r.spectators).length;
  });
  res.json({ activeRooms: rooms.size, totalPlayers, totalSavedMatches });
});

app.get('/api/leaderboard', async (req, res) => {
  if (!isDbConnected) return res.json({ success: true, data: [] });
  try {
    const list = await PlayerStat.find().sort({ wins: -1, winRate: -1 }).limit(20).lean();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/matches', async (req, res) => {
  if (!isDbConnected) return res.json({ success: true, data: [] });
  try {
    const list = await Match.find().sort({ createdAt: -1 }).limit(15).lean();
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket logic
io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('room:create', ({ playerName, preferredCode }) => {
    const cleanName = (playerName || 'Player 1').trim().slice(0, 20) || 'Player 1';
    let roomId = preferredCode ? preferredCode.trim().toUpperCase().slice(0, 10) : generateRoomCode();

    if (!preferredCode) {
      while (rooms.has(roomId)) roomId = generateRoomCode();
    } else if (rooms.has(roomId)) {
      socket.emit('room:error', { message: `Room "${roomId}" already exists.` });
      return;
    }

    const room = {
      id: roomId,
      players: {
        [socket.id]: { id: socket.id, name: cleanName, symbol: 'X', isHost: true, connected: true },
      },
      spectators: {},
      board: Array(9).fill(null),
      currentTurn: 'X',
      status: 'waiting',
      winner: null,
      winningLine: null,
      scores: { X: 0, O: 0, ties: 0 },
      rematchVotes: [],
      movesCount: 0,
    };

    rooms.set(roomId, room);
    currentRoomId = roomId;
    socket.join(roomId);

    socket.emit('room:created', {
      roomId,
      player: room.players[socket.id],
      gameState: sanitizeRoom(room),
    });
  });

  socket.on('room:join', ({ roomId, playerName, asSpectator }) => {
    const cleanCode = (roomId || '').trim().toUpperCase();
    const cleanName = (playerName || 'Player 2').trim().slice(0, 20) || 'Player 2';
    const room = rooms.get(cleanCode);

    if (!room) {
      socket.emit('room:error', { message: `Room "${cleanCode}" not found.` });
      return;
    }

    const currentPlayers = Object.values(room.players);
    if (asSpectator || currentPlayers.length >= 2) {
      room.spectators[socket.id] = { id: socket.id, name: cleanName };
      currentRoomId = cleanCode;
      socket.join(cleanCode);
      socket.emit('room:joined', { roomId: cleanCode, role: 'spectator', gameState: sanitizeRoom(room) });
      io.to(cleanCode).emit('room:update', sanitizeRoom(room));
      return;
    }

    const existingSymbols = new Set(currentPlayers.map((p) => p.symbol));
    const symbolToAssign = existingSymbols.has('X') ? 'O' : 'X';

    room.players[socket.id] = {
      id: socket.id,
      name: cleanName,
      symbol: symbolToAssign,
      isHost: false,
      connected: true,
    };

    if (Object.keys(room.players).length === 2 && room.status === 'waiting') {
      room.status = 'in_progress';
      room.currentTurn = 'X';
    }

    currentRoomId = cleanCode;
    socket.join(cleanCode);

    socket.emit('room:joined', {
      roomId: cleanCode,
      role: 'player',
      player: room.players[socket.id],
      gameState: sanitizeRoom(room),
    });

    io.to(cleanCode).emit('room:update', sanitizeRoom(room));
  });

  socket.on('game:move', async ({ cellIndex }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const player = room.players[socket.id];
    if (!player || room.status !== 'in_progress' || player.symbol !== room.currentTurn) return;
    if (cellIndex < 0 || cellIndex > 8 || room.board[cellIndex] !== null) return;

    room.board[cellIndex] = player.symbol;
    room.movesCount = (room.movesCount || 0) + 1;
    const winResult = checkWinner(room.board);

    if (winResult) {
      room.status = 'won';
      room.winner = winResult.winner;
      room.winningLine = winResult.line;
      room.scores[winResult.winner]++;
      room.rematchVotes = [];

      io.to(room.id).emit('game:over', {
        result: 'win',
        winner: winResult.winner,
        winningLine: winResult.line,
        winnerName: player.name,
        gameState: sanitizeRoom(room),
      });

      // Save to MongoDB if connected
      if (isDbConnected) {
        const pList = Object.values(room.players);
        const pX = pList.find((p) => p.symbol === 'X');
        const pO = pList.find((p) => p.symbol === 'O');
        if (pX && pO) {
          Match.create({
            roomId: room.id,
            playerX: { id: pX.id, name: pX.name },
            playerO: { id: pO.id, name: pO.name },
            winner: winResult.winner,
            winnerName: player.name,
            winningLine: winResult.line,
            board: room.board,
            movesCount: room.movesCount,
          }).catch(() => {});
        }
      }
    } else if (room.board.every((cell) => cell !== null)) {
      room.status = 'draw';
      room.winner = null;
      room.winningLine = null;
      room.scores.ties++;
      room.rematchVotes = [];

      io.to(room.id).emit('game:over', {
        result: 'draw',
        winner: null,
        winningLine: null,
        gameState: sanitizeRoom(room),
      });
    } else {
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
      io.to(room.id).emit('game:update', sanitizeRoom(room));
    }
  });

  socket.on('game:rematch', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || !room.players[socket.id]) return;

    if (!room.rematchVotes.includes(socket.id)) {
      room.rematchVotes.push(socket.id);
    }

    if (room.rematchVotes.length >= Math.min(2, Object.keys(room.players).length)) {
      room.board = Array(9).fill(null);
      room.winner = null;
      room.winningLine = null;
      room.rematchVotes = [];
      room.status = 'in_progress';
      room.currentTurn = 'X';

      io.to(room.id).emit('game:rematch_started', sanitizeRoom(room));
    } else {
      io.to(room.id).emit('game:rematch_requested', {
        requestedBy: room.players[socket.id].name,
      });
    }
  });

  socket.on('chat:send', ({ text, type }) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const sender = room.players[socket.id] || room.spectators[socket.id];
    io.to(currentRoomId).emit('chat:message', {
      senderId: socket.id,
      senderName: sender ? sender.name : 'Unknown',
      text: (text || '').trim().slice(0, 100),
      type: type || 'text',
      timestamp: Date.now(),
    });
  });

  const leave = () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const p = room.players[socket.id];
    if (p) {
      delete room.players[socket.id];
      if (room.status === 'in_progress') room.status = 'abandoned';
      io.to(currentRoomId).emit('room:player_left', {
        playerId: socket.id,
        playerName: p.name,
        symbol: p.symbol,
        gameState: sanitizeRoom(room),
      });
    }
  };

  socket.on('room:leave', leave);
  socket.on('disconnect', leave);
});

app.get('*', (req, res) => res.sendFile(path.join(staticDir, 'index.html')));

server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));
