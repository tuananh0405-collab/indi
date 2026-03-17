import mongoose, { Schema, Model, Types } from 'mongoose';

// ─── Status Enum ──────────────────────────────────────────────
export const ORDER_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ─── Interface ────────────────────────────────────────────────
export interface IOrder {
  _id: Types.ObjectId;
  orderCode: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  quantity: number;
  totalAmount: number;
  status: OrderStatus;
  paymentLink: string;
  paymentLinkId: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────
const orderSchema = new Schema<IOrder>(
  {
    orderCode: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    buyerName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    buyerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    buyerPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 5, // reasonable per-order limit
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ORDER_STATUSES,
      default: 'PENDING',
    },
    paymentLink: {
      type: String,
      default: '',
    },
    paymentLinkId: {
      type: String,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Indexes ──────────────────────────────────────────────────
// Compound index for TTL cleanup: find PENDING orders older than X
orderSchema.index({ status: 1, createdAt: 1 });

// Index for admin search by buyer email
orderSchema.index({ buyerEmail: 1 });

// ─── Model ────────────────────────────────────────────────────
const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
