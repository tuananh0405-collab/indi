import mongoose, { Schema, Model, Types } from 'mongoose';

// ─── Status Enum ──────────────────────────────────────────────
export const TICKET_STATUSES = ['HOLDING', 'ACTIVE', 'INACTIVE', 'EXPIRED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// ─── Ticket Type Enum ─────────────────────────────────────────
export const TICKET_TYPES = ['EARLY_BIRD', 'STANDARD', 'VIP'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

// ─── Interface ────────────────────────────────────────────────
export interface ITicket {
  _id: Types.ObjectId;
  uuid: string;
  orderId: Types.ObjectId;
  orderCode: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  ticketType: TicketType;
  price: number;
  status: TicketStatus;
  checkedIn: boolean;
  checkedInAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  notes: string;
  updatedBy: string;
  promoCode: string;
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
    ticketType: {
      type: String,
      required: true,
      enum: TICKET_TYPES,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
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
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    updatedBy: {
      type: String,
      default: '',
      trim: true,
    },
    promoCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 50,
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

// Filter by ticket type
ticketSchema.index({ ticketType: 1 });

// Date range filter (admin list)
ticketSchema.index({ createdAt: 1 });

// Compound index for atomic check-in: optimizes { checkedIn: false, status: 'ACTIVE' }
ticketSchema.index({ checkedIn: 1, status: 1 });

// ─── Model ────────────────────────────────────────────────────
const Ticket: Model<ITicket> = mongoose.model<ITicket>('Ticket', ticketSchema);

export default Ticket;
