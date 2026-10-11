import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayerStat extends Document {
  usernameLower: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
  lastPlayed: Date;
}

const PlayerStatSchema = new Schema<IPlayerStat>(
  {
    usernameLower: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    totalGames: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    lastPlayed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const PlayerStat =
  mongoose.models.PlayerStat || mongoose.model<IPlayerStat>('PlayerStat', PlayerStatSchema);
