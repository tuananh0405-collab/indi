import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Events ──────────────────────────────────────────────────────────────────
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  date: text('date').notNull(),
  location: text('location'),
  capacity: integer('capacity').notNull().default(400),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Ticket Types ────────────────────────────────────────────────────────────
export const ticketTypes = sqliteTable('ticket_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => events.id),
  name: text('name').notNull(),         // e.g. 'EARLY_BIRD'
  label: text('label').notNull(),       // e.g. 'Early Bird'
  price: integer('price').notNull(),    // VND
  capacity: integer('capacity'),        // NULL = uses event capacity
  sold: integer('sold').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderCode: integer('order_code').notNull().unique(),
  eventId: integer('event_id').notNull().references(() => events.id),
  buyerName: text('buyer_name').notNull(),
  buyerEmail: text('buyer_email').notNull(),
  buyerPhone: text('buyer_phone').notNull(),
  totalQuantity: integer('total_quantity').notNull(),
  totalAmount: integer('total_amount').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  promoCode: text('promo_code').default(''),
  status: text('status').notNull().default('PENDING'), // PENDING | PAID | EXPIRED | CANCELLED
  paymentLink: text('payment_link').default(''),
  paymentLinkId: text('payment_link_id').default(''),
  paymentBin: text('payment_bin').default(''),
  paymentAccountNumber: text('payment_account_number').default(''),
  paymentAccountName: text('payment_account_name').default(''),
  paidAt: text('paid_at'),
  notes: text('notes').default(''),
  createdBy: text('created_by').default(''),   // 'system' or admin email
  updatedBy: text('updated_by').default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Order Items ─────────────────────────────────────────────────────────────
export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id),
  ticketTypeId: integer('ticket_type_id').notNull().references(() => ticketTypes.id),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
});

// ─── Tickets ─────────────────────────────────────────────────────────────────
export const tickets = sqliteTable('tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull().unique(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  orderCode: integer('order_code').notNull(),
  ticketTypeId: integer('ticket_type_id').notNull().references(() => ticketTypes.id),
  buyerName: text('buyer_name').notNull(),
  buyerEmail: text('buyer_email').notNull(),
  buyerPhone: text('buyer_phone').notNull(),
  price: integer('price').notNull(),
  status: text('status').notNull().default('HOLDING'), // HOLDING | ACTIVE | INACTIVE | EXPIRED | CANCELLED
  checkedIn: integer('checked_in', { mode: 'boolean' }).notNull().default(false),
  checkedInAt: text('checked_in_at'),
  checkedInBy: text('checked_in_by').default(''),
  emailSent: integer('email_sent', { mode: 'boolean' }).notNull().default(false),
  emailSentAt: text('email_sent_at'),
  notes: text('notes').default(''),
  updatedBy: text('updated_by').default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Promo Codes ─────────────────────────────────────────────────────────────
export const promoCodes = sqliteTable('promo_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),           // e.g. 'EARLYBIRD20'
  discountType: text('discount_type').notNull(),   // 'percent' | 'fixed'
  discountValue: integer('discount_value').notNull(), // 20 (%) or 50000 (VND)
  maxUses: integer('max_uses'),                    // NULL = unlimited
  usedCount: integer('used_count').notNull().default(0),
  minOrderAmount: integer('min_order_amount').default(0),
  validFrom: text('valid_from'),                   // ISO date
  validUntil: text('valid_until'),                 // ISO date
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// ─── Admins ──────────────────────────────────────────────────────────────────
export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  picture: text('picture').default(''),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
