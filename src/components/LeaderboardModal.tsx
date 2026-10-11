import React, { useState, useEffect } from 'react';
import { Trophy, History, RefreshCw, X, Database, Flame, Clock } from 'lucide-react';
import { backendApiUrl } from '../utils/backendUrl';

interface LeaderboardPlayer {
  _id: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  lastPlayed: string;
}

interface MatchRecord {
  _id: string;
  roomId: string;
  playerX: { name: string };
  playerO: { name: string };
  winner: 'X' | 'O' | 'draw' | 'abandoned';
  winnerName?: string;
  movesCount: number;
  createdAt: string;
}

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'leaderboard' | 'history'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<string>('checking...');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Attempt reconnection if disconnected
      await fetch(backendApiUrl('/api/db/retry'), { method: 'POST' }).catch(() => {});

      const [lbRes, matchRes, healthRes] = await Promise.all([
        fetch(backendApiUrl('/api/leaderboard')).then((r) => r.json()),
        fetch(backendApiUrl('/api/matches')).then((r) => r.json()),
        fetch(backendApiUrl('/api/health')).then((r) => r.json()),
      ]);

      if (lbRes.success) setLeaderboard(lbRes.data || []);
      if (matchRes.success) setMatches(matchRes.data || []);
      setDbStatus(healthRes.database || 'unknown');
    } catch {
      setDbStatus('offline_or_fallback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                MongoDB Arena Stats
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                    dbStatus === 'connected'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                      : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                  }`}
                >
                  <Database className="w-3 h-3" />
                  {dbStatus === 'connected' ? 'MongoDB Live' : 'Fallback / In-Memory'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Persistent career records & recent match results saved in MongoDB Atlas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('leaderboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tab === 'leaderboard'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                tab === 'history'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Recent Matches
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition flex items-center gap-1"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* MongoDB Atlas Tip if offline/unreachable */}
        {dbStatus !== 'connected' && (
          <div className="bg-amber-950/40 border-b border-amber-900/60 px-6 py-2.5 text-xs text-amber-200/95 flex items-start gap-2">
            <Database className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-300">Atlas IP Whitelist Tip:</strong> If MongoDB is offline, go to{' '}
              <span className="font-semibold text-white">MongoDB Atlas &rarr; Network Access &rarr; Add IP Address</span>{' '}
              and add <code className="bg-slate-950 px-1.5 py-0.5 rounded text-cyan-300 font-mono">0.0.0.0/0</code>{' '}
              (Allow access from anywhere). Then click the refresh button!
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {tab === 'leaderboard' && (
            <div>
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
                  <p className="font-semibold text-slate-400">No matches saved in MongoDB yet.</p>
                  <p className="mt-1">Play an online multiplayer match to record your first stats!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 text-[11px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                    <span className="col-span-1">#</span>
                    <span className="col-span-5">Player</span>
                    <span className="col-span-2 text-center">Wins</span>
                    <span className="col-span-2 text-center">Games</span>
                    <span className="col-span-2 text-right">Win Rate</span>
                  </div>

                  {leaderboard.map((item, idx) => (
                    <div
                      key={item._id || idx}
                      className="grid grid-cols-12 items-center px-3 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs transition hover:border-slate-700"
                    >
                      <span className="col-span-1 font-bold text-slate-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </span>
                      <span className="col-span-5 font-bold text-white truncate flex items-center gap-1.5">
                        {item.displayName}
                        {idx === 0 && <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </span>
                      <span className="col-span-2 text-center font-extrabold text-cyan-400">
                        {item.wins}
                      </span>
                      <span className="col-span-2 text-center text-slate-400">
                        {item.totalGames}
                      </span>
                      <span className="col-span-2 text-right font-bold text-emerald-400">
                        {item.winRate}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div>
              {matches.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-purple-400" />
                  <p className="font-semibold text-slate-400">No recent matches recorded yet.</p>
                  <p className="mt-1">Finish a game to view the MongoDB match log.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {matches.map((m, idx) => {
                    const isDraw = m.winner === 'draw';
                    return (
                      <div
                        key={m._id || idx}
                        className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-1.5 py-0.5 rounded">
                              {m.roomId}
                            </span>
                            <span className="font-bold text-white">
                              {m.playerX?.name} (X) vs {m.playerO?.name} (O)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'} • {m.movesCount || 0} moves
                          </div>
                        </div>

                        <div className="text-right">
                          {isDraw ? (
                            <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[11px] font-bold">
                              Draw
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[11px] font-bold">
                              Winner: {m.winnerName || `Player ${m.winner}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            MongoDB Collection: <code>matches</code> & <code>playerstats</code>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
