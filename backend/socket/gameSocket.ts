import { Server as SocketIOServer, Socket } from 'socket.io';
import { Match } from '../models/Match.js';
import { PlayerStat } from '../models/PlayerStat.js';
import { isDbConnected } from '../db/connect.js';

export interface Player {
  id: string;
  name: string;
  symbol: 'X' | 'O';
  isHost: boolean;
  connected: boolean;
}

export interface Spectator {
  id: string;
  name: string;
}

export interface GameRoom {
  id: string;
  players: { [id: string]: Player };
  spectators: { [id: string]: Spectator };
  board: (string | null)[];
  currentTurn: 'X' | 'O';
  status: 'waiting' | 'in_progress' | 'won' | 'draw' | 'abandoned';
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  scores: { X: number; O: number; ties: number };
  rematchVotes: string[];
  movesCount: number;
  lastActive: number;
}

export const activeRooms: Map<string, GameRoom> = new Map();

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function checkWinner(board: (string | null)[]): { winner: 'X' | 'O'; line: number[] } | null {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', line: combo };
    }
  }
  return null;
}

export function sanitizeRoom(room: GameRoom) {
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
    movesCount: room.movesCount,
  };
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Persist Match & Player Career Stats into MongoDB
async function persistMatchResult(room: GameRoom, outcome: 'X' | 'O' | 'draw') {
  if (!isDbConnected()) return;

  const playerList = Object.values(room.players);
  const pX = playerList.find((p) => p.symbol === 'X');
  const pO = playerList.find((p) => p.symbol === 'O');

  if (!pX || !pO) return;

  try {
    const winnerName = outcome === 'X' ? pX.name : outcome === 'O' ? pO.name : undefined;

    // 1. Save Match record
    await Match.create({
      roomId: room.id,
      playerX: { id: pX.id, name: pX.name },
      playerO: { id: pO.id, name: pO.name },
      winner: outcome,
      winnerName,
      winningLine: room.winningLine || [],
      board: room.board,
      movesCount: room.movesCount,
    });

    // 2. Helper to upsert player career stats
    const updatePlayer = async (name: string, isWin: boolean, isDraw: boolean) => {
      const usernameLower = name.trim().toLowerCase();
      let stat = await PlayerStat.findOne({ usernameLower });
      if (!stat) {
        stat = new PlayerStat({
          usernameLower,
          displayName: name.trim(),
          wins: 0,
          losses: 0,
          draws: 0,
          totalGames: 0,
          winRate: 0,
        });
      }

      stat.displayName = name.trim();
      stat.totalGames += 1;
      if (isDraw) {
        stat.draws += 1;
      } else if (isWin) {
        stat.wins += 1;
      } else {
        stat.losses += 1;
      }
      stat.winRate = Math.round((stat.wins / stat.totalGames) * 100);
      stat.lastPlayed = new Date();
      await stat.save();
    };

    if (outcome === 'draw') {
      await updatePlayer(pX.name, false, true);
      await updatePlayer(pO.name, false, true);
    } else if (outcome === 'X') {
      await updatePlayer(pX.name, true, false);
      await updatePlayer(pO.name, false, false);
    } else if (outcome === 'O') {
      await updatePlayer(pO.name, true, false);
      await updatePlayer(pX.name, false, false);
    }

    console.log(`[MongoDB] Match in room ${room.id} persisted successfully.`);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[MongoDB] Failed to persist match result:', error.message);
  }
}

export function setupGameSocket(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;

    // Create room
    socket.on('room:create', ({ playerName, preferredCode }: { playerName: string; preferredCode?: string }) => {
      const cleanName = (playerName || 'Player 1').trim().slice(0, 20) || 'Player 1';
      let roomId = preferredCode ? preferredCode.trim().toUpperCase().slice(0, 10) : generateRoomCode();

      if (!preferredCode) {
        while (activeRooms.has(roomId)) {
          roomId = generateRoomCode();
        }
      } else if (activeRooms.has(roomId)) {
        socket.emit('room:error', { message: `Room "${roomId}" already exists. Try joining it instead.` });
        return;
      }

      const room: GameRoom = {
        id: roomId,
        players: {
          [socket.id]: {
            id: socket.id,
            name: cleanName,
            symbol: 'X',
            isHost: true,
            connected: true,
          },
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
        lastActive: Date.now(),
      };

      activeRooms.set(roomId, room);
      currentRoomId = roomId;
      socket.join(roomId);

      socket.emit('room:created', {
        roomId,
        player: room.players[socket.id],
        gameState: sanitizeRoom(room),
      });

      console.log(`[Socket] Room created: ${roomId} by ${cleanName}`);
    });

    // Join room
    socket.on('room:join', ({ roomId, playerName, asSpectator }: { roomId: string; playerName: string; asSpectator?: boolean }) => {
      const cleanCode = (roomId || '').trim().toUpperCase();
      const cleanName = (playerName || 'Player 2').trim().slice(0, 20) || 'Player 2';
      const room = activeRooms.get(cleanCode);

      if (!room) {
        socket.emit('room:error', { message: `Room code "${cleanCode}" not found.` });
        return;
      }

      const currentPlayers = Object.values(room.players);

      if (asSpectator || currentPlayers.length >= 2) {
        room.spectators[socket.id] = { id: socket.id, name: cleanName };
        currentRoomId = cleanCode;
        socket.join(cleanCode);

        socket.emit('room:joined', {
          roomId: cleanCode,
          role: 'spectator',
          gameState: sanitizeRoom(room),
        });

        io.to(cleanCode).emit('room:update', sanitizeRoom(room));
        io.to(cleanCode).emit('chat:system', {
          text: `${cleanName} joined as a spectator`,
          timestamp: Date.now(),
        });
        return;
      }

      const existingSymbols = new Set(currentPlayers.map((p) => p.symbol));
      const symbolToAssign: 'X' | 'O' = existingSymbols.has('X') ? 'O' : 'X';

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
      io.to(cleanCode).emit('chat:system', {
        text: `${cleanName} joined as Player (${symbolToAssign}). Game started!`,
        timestamp: Date.now(),
      });
    });

    // Move
    socket.on('game:move', async ({ cellIndex }: { cellIndex: number }) => {
      if (!currentRoomId) return;
      const room = activeRooms.get(currentRoomId);
      if (!room) return;

      const player = room.players[socket.id];
      if (!player) {
        socket.emit('game:error', { message: 'Only active players can make moves.' });
        return;
      }

      if (room.status !== 'in_progress') {
        socket.emit('game:error', { message: 'Game is not in progress.' });
        return;
      }

      if (player.symbol !== room.currentTurn) {
        socket.emit('game:error', { message: `Wait for Player ${room.currentTurn}'s turn.` });
        return;
      }

      if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8 || room.board[cellIndex] !== null) {
        socket.emit('game:error', { message: 'Invalid move or cell already occupied.' });
        return;
      }

      // Apply move
      room.board[cellIndex] = player.symbol;
      room.movesCount += 1;
      room.lastActive = Date.now();

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

        // Persist to MongoDB
        persistMatchResult(room, winResult.winner).catch(() => {});
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

        // Persist to MongoDB
        persistMatchResult(room, 'draw').catch(() => {});
      } else {
        room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';
        io.to(room.id).emit('game:update', sanitizeRoom(room));
      }
    });

    // Rematch
    socket.on('game:rematch', () => {
      if (!currentRoomId) return;
      const room = activeRooms.get(currentRoomId);
      if (!room || !room.players[socket.id]) return;

      if (!room.rematchVotes.includes(socket.id)) {
        room.rematchVotes.push(socket.id);
      }

      const requiredVotes = Math.min(2, Object.keys(room.players).length);

      if (room.rematchVotes.length >= requiredVotes) {
        room.board = Array(9).fill(null);
        room.winner = null;
        room.winningLine = null;
        room.rematchVotes = [];
        room.movesCount = 0;
        room.status = 'in_progress';
        room.currentTurn = 'X';

        io.to(room.id).emit('game:rematch_started', sanitizeRoom(room));
        io.to(room.id).emit('chat:system', {
          text: 'Both players accepted rematch! Round started.',
          timestamp: Date.now(),
        });
      } else {
        io.to(room.id).emit('game:rematch_requested', {
          requestedBy: room.players[socket.id].name,
          votes: room.rematchVotes.length,
          totalRequired: requiredVotes,
        });
      }
    });

    // Chat
    socket.on('chat:send', ({ text, type }: { text: string; type?: 'text' | 'reaction' }) => {
      if (!currentRoomId) return;
      const room = activeRooms.get(currentRoomId);
      if (!room) return;

      const sender = room.players[socket.id] || room.spectators[socket.id];
      const cleanText = (text || '').trim().slice(0, 100);
      if (!cleanText) return;

      io.to(currentRoomId).emit('chat:message', {
        senderId: socket.id,
        senderName: sender ? sender.name : 'Unknown',
        text: cleanText,
        type: type || 'text',
        symbol: sender && 'symbol' in sender ? (sender as Player).symbol : null,
        timestamp: Date.now(),
      });
    });

    // Player Leave / Disconnect
    const handleLeave = () => {
      if (!currentRoomId) return;
      const room = activeRooms.get(currentRoomId);
      if (!room) return;

      const leavingPlayer = room.players[socket.id];
      if (leavingPlayer) {
        delete room.players[socket.id];
        if (room.status === 'in_progress') {
          room.status = 'abandoned';
        }

        io.to(currentRoomId).emit('room:player_left', {
          playerId: socket.id,
          playerName: leavingPlayer.name,
          symbol: leavingPlayer.symbol,
          gameState: sanitizeRoom(room),
        });
        io.to(currentRoomId).emit('chat:system', {
          text: `${leavingPlayer.name} disconnected.`,
          timestamp: Date.now(),
        });
      } else if (room.spectators[socket.id]) {
        delete room.spectators[socket.id];
        io.to(currentRoomId).emit('room:update', sanitizeRoom(room));
      }

      if (Object.keys(room.players).length === 0 && Object.keys(room.spectators).length === 0) {
        setTimeout(() => {
          const r = activeRooms.get(currentRoomId || '');
          if (r && Object.keys(r.players).length === 0) {
            activeRooms.delete(currentRoomId || '');
          }
        }, 15000);
      }
    };

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
