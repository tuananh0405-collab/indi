import mongoose, { Schema, Model } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────
export interface ICounter {
  _id: string;
  total: number;
  sold: number;
}

// ─── Schema ───────────────────────────────────────────────────
const counterSchema = new Schema<ICounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    sold: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// ─── Model ────────────────────────────────────────────────────
const Counter: Model<ICounter> = mongoose.model<ICounter>('Counter', counterSchema);

export default Counter;
