import request from 'supertest';
import app from '../src/app';
import Order from '../src/models/Order';
import Ticket from '../src/models/Ticket';
import { setupTestDb, clearTestDb, teardownTestDb, createTestOrder } from './helpers';

// ─── Mock external services ──────────────────────────────────
const mockPayos = require('./__mocks__/payos.service').default;
jest.mock('../src/services/payos.service', () => require('./__mocks__/payos.service').default);
jest.mock('../src/services/email.service', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue(undefined),
}));

function buildWebhookPayload(orderCode: number, signature = 'valid') {
  return {
    code: '00',
    desc: 'success',
    success: true,
    data: {
      orderCode,
      amount: 100000,
      description: `INDI ${orderCode}`,
      accountNumber: '123456789',
      reference: 'TXN123',
      transactionDateTime: '2026-03-17 19:30:00',
      paymentLinkId: 'test-link',
      code: '00',
      desc: 'success',
    },
    signature,
  };
}

describe('POST /api/webhooks/payos', () => {
  beforeAll(async () => await setupTestDb());
  afterEach(async () => {
    await clearTestDb();
    jest.clearAllMocks();
  });
  afterAll(async () => await teardownTestDb());

  it('should return 200 even with invalid checksum (silent ignore)', async () => {
    const payload = buildWebhookPayload(12345, 'invalid');

    const res = await request(app).post('/api/webhooks/payos').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should acknowledge test webhook (orderCode=123) without DB changes', async () => {
    const payload = buildWebhookPayload(123);

    const res = await request(app).post('/api/webhooks/payos').send(payload);
    expect(res.status).toBe(200);

    const orders = await Order.find({});
    expect(orders).toHaveLength(0);
  });

  it('should transition PENDING → PAID and activate tickets', async () => {
    const { order, tickets } = await createTestOrder({ quantity: 2 });

    const payload = buildWebhookPayload(order.orderCode);
    const res = await request(app).post('/api/webhooks/payos').send(payload);
    expect(res.status).toBe(200);

    // Verify order is now PAID
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder!.status).toBe('PAID');
    expect(updatedOrder!.paidAt).toBeDefined();

    // Verify tickets are now ACTIVE
    const updatedTickets = await Ticket.find({ orderId: order._id });
    updatedTickets.forEach((t) => {
      expect(t.status).toBe('ACTIVE');
    });
  });

  it('should be idempotent — duplicate webhook has no effect', async () => {
    const { order } = await createTestOrder({ quantity: 1 });
    const payload = buildWebhookPayload(order.orderCode);

    // First call
    await request(app).post('/api/webhooks/payos').send(payload);
    const orderAfterFirst = await Order.findById(order._id);
    expect(orderAfterFirst!.status).toBe('PAID');
    const paidAt = orderAfterFirst!.paidAt!.toISOString();

    // Second call (duplicate)
    await request(app).post('/api/webhooks/payos').send(payload);
    const orderAfterSecond = await Order.findById(order._id);
    expect(orderAfterSecond!.status).toBe('PAID');
    expect(orderAfterSecond!.paidAt!.toISOString()).toBe(paidAt); // unchanged

    // Verify only 1 ticket (not duplicated)
    const tickets = await Ticket.find({ orderId: order._id });
    expect(tickets).toHaveLength(1);
  });

  it('should not process webhook for EXPIRED order', async () => {
    const { order } = await createTestOrder({ status: 'EXPIRED', quantity: 1 });
    // Set tickets to EXPIRED too
    await Ticket.updateMany({ orderId: order._id }, { status: 'EXPIRED' });

    const payload = buildWebhookPayload(order.orderCode);
    const res = await request(app).post('/api/webhooks/payos').send(payload);
    expect(res.status).toBe(200);

    // Order should still be EXPIRED (not changed to PAID)
    const updatedOrder = await Order.findById(order._id);
    expect(updatedOrder!.status).toBe('EXPIRED');
  });
});
