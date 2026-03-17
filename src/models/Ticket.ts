import mongoose, { Schema, Model, Types } from 'mongoose';

// ─── Status Enum ──────────────────────────────────────────────
export const TICKET_STATUSES = ['HOLDING', 'ACTIVE', 'INACTIVE', 'EXPIRED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// ─── Interface ────────────────────────────────────────────────
export interface ITicket {
  _id: Types.ObjectId;
  uuid: string;
  orderId: Types.ObjectId;
  orderCode: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  status: TicketStatus;
  checkedIn: boolean;
  checkedInAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────
const ticketSchema = new Schema<ITicket>(
  {
    uuid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderCode: {
      type: Number,
      required: true,
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
    status: {
      type: String,
      required: true,
      enum: TICKET_STATUSES,
      default: 'HOLDING',
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
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
// Search by buyer email (admin search)
ticketSchema.index({ buyerEmail: 1 });

// Filter by status (admin list, dashboard aggregation)
ticketSchema.index({ status: 1 });

// ─── Model ────────────────────────────────────────────────────
const Ticket: Model<ITicket> = mongoose.model<ITicket>('Ticket', ticketSchema);

export default Ticket;
