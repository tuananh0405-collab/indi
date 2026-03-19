import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Counter from '../src/models/Counter';
import Order from '../src/models/Order';
import Ticket from '../src/models/Ticket';

/**
 * Connect to the in-memory MongoDB and seed the Counter.
 * Call in beforeAll() of each test file.
 */
export async function setupTestDb(): Promise<void> {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);
  await seedCounter();
}

/**
 * Clear all collections between tests.
 * Call in afterEach() for isolation.
 */
export async function clearTestDb(): Promise<void> {
  await Order.deleteMany({});
  await Ticket.deleteMany({});
  // Reset counter to fresh state
  await Counter.updateOne(
    { _id: 'ticket_capacity' },
    { $set: { sold: 0, total: 400 } },
    { upsert: true }
  );
}

/**
 * Disconnect from MongoDB.
 * Call in afterAll().
 */
export async function teardownTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

/**
 * Seed the ticket_capacity Counter document.
 */
async function seedCounter(): Promise<void> {
  await Counter.findOneAndUpdate(
    { _id: 'ticket_capacity' },
    { $setOnInsert: { total: 400, sold: 0 } },
    { upsert: true, new: true }
  );
}

/**
 * Generate a valid admin JWT for test requests.
 */
export function getAdminToken(email = 'admin@test.com'): string {
  return jwt.sign(
    { email, name: 'Test Admin' },
    process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only',
    { expiresIn: '1h' }
  );
}

/**
 * Create a test order directly in the DB (bypasses API).
 * Useful for setting up preconditions.
 */
export async function createTestOrder(overrides: Partial<{
  orderCode: number;
  status: string;
  quantity: number;
  totalAmount: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
}> = {}) {
  const orderCode = overrides.orderCode || Date.now();
  const qty = overrides.quantity || 1;

  const order = await Order.create({
    orderCode,
    buyerName: overrides.buyerName || 'Test Buyer',
    buyerEmail: overrides.buyerEmail || 'buyer@test.com',
    buyerPhone: overrides.buyerPhone || '0901234567',
    quantity: qty,
    totalAmount: overrides.totalAmount || qty * 100000,
    status: overrides.status || 'PENDING',
    paymentLink: 'https://pay.test/mock',
    paymentLinkId: 'mock-link',
  });

  // Create tickets
  const { v4: uuidv4 } = await import('uuid');
  const tickets = await Ticket.insertMany(
    Array.from({ length: qty }, () => ({
      uuid: uuidv4(),
      orderId: order._id,
      orderCode: order.orderCode,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      status: overrides.status === 'PAID' ? 'ACTIVE' : 'HOLDING',
    }))
  );

  // Update counter
  await Counter.updateOne(
    { _id: 'ticket_capacity' },
    { $inc: { sold: qty } }
  );

  return { order, tickets };
}
