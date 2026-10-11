import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  roomId: string;
  playerX: {
    id: string;
    name: string;
  };
  playerO: {
    id: string;
    name: string;
  };
  winner: 'X' | 'O' | 'draw' | 'abandoned';
  winnerName?: string;
  winningLine?: number[];
  board: (string | null)[];
  movesCount: number;
  createdAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    roomId: { type: String, required: true, index: true },
    playerX: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    playerO: {
      id: { type: String, required: true },
      name: { type: String, required: true },
    },
    winner: {
      type: String,
      enum: ['X', 'O', 'draw', 'abandoned'],
      required: true,
    },
    winnerName: { type: String },
    winningLine: [{ type: Number }],
    board: [{ type: String, default: null }],
    movesCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Match = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);
