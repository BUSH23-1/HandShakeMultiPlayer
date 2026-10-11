import express from 'express';
import { isDbConnected } from '../db/connect.js';
import { Match } from '../models/Match.js';
import { PlayerStat } from '../models/PlayerStat.js';
import { activeRooms } from '../socket/gameSocket.js';

export const apiRouter = express.Router();

// Health check with DB status
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isDbConnected() ? 'connected' : 'disconnected_or_offline',
    timestamp: Date.now(),
  });
});

// Explicit reconnection attempt
apiRouter.post('/db/retry', async (req, res) => {
  const { connectDB } = await import('../db/connect.js');
  const success = await connectDB();
  res.json({ success, database: success ? 'connected' : 'disconnected_or_offline' });
});

// Overall stats
apiRouter.get('/stats', async (req, res) => {
  let totalSavedMatches = 0;
  let totalRegisteredPlayers = 0;

  if (isDbConnected()) {
    try {
      totalSavedMatches = await Match.countDocuments();
      totalRegisteredPlayers = await PlayerStat.countDocuments();
    } catch {
      // fallback
    }
  }

  let totalOnlinePlayers = 0;
  activeRooms.forEach((r) => {
    totalOnlinePlayers += Object.keys(r.players).length + Object.keys(r.spectators).length;
  });

  res.json({
    activeRooms: activeRooms.size,
    totalOnlinePlayers,
    totalSavedMatches,
    totalRegisteredPlayers,
    dbStatus: isDbConnected() ? 'connected' : 'in-memory-mode',
  });
});

// Live Leaderboard from MongoDB
apiRouter.get('/leaderboard', async (req, res) => {
  if (!isDbConnected()) {
    return res.json({
      success: true,
      data: [],
      message: 'MongoDB is running in fallback/in-memory mode.',
    });
  }

  try {
    const topPlayers = await PlayerStat.find({})
      .sort({ wins: -1, winRate: -1, totalGames: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      data: topPlayers,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recent Matches from MongoDB
apiRouter.get('/matches', async (req, res) => {
  if (!isDbConnected()) {
    return res.json({
      success: true,
      data: [],
      message: 'MongoDB running in fallback mode.',
    });
  }

  try {
    const recentMatches = await Match.find({})
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    res.json({
      success: true,
      data: recentMatches,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ success: false, error: err.message });
  }
});

// Check room existence
apiRouter.get('/room/:code/exists', (req, res) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const room = activeRooms.get(code);

  if (!room) {
    return res.json({ exists: false });
  }

  const playerCount = Object.keys(room.players).length;
  res.json({
    exists: true,
    playerCount,
    status: room.status,
    isFull: playerCount >= 2,
  });
});
