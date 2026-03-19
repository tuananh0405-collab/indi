import request from 'supertest';
import app from '../src/app';
import Counter from '../src/models/Counter';
import Order from '../src/models/Order';
import Ticket from '../src/models/Ticket';
import { setupTestDb, clearTestDb, teardownTestDb, getAdminToken } from './helpers';

// ─── Mock external services ──────────────────────────────────
jest.mock('../src/services/payos.service', () => require('./__mocks__/payos.service').default);
jest.mock('../src/services/email.service', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue(undefined),
}));

const VALID_ORDER = {
  buyerName: 'Nguyen Van A',
  buyerEmail: 'vana@gmail.com',
  buyerPhone: '0901234567',
  quantity: 2,
  ticketPrice: 150000,
};

describe('POST /api/orders', () => {
  beforeAll(async () => await setupTestDb());
  afterEach(async () => await clearTestDb());
  afterAll(async () => await teardownTestDb());

  // ─── Validation ───────────────────────────────────────────

  it('should reject missing buyerName', async () => {
    const { buyerName, ...body } = VALID_ORDER;
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing buyerEmail', async () => {
    const { buyerEmail, ...body } = VALID_ORDER;
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
  });

  it('should reject missing buyerPhone', async () => {
    const { buyerPhone, ...body } = VALID_ORDER;
    const res = await request(app).post('/api/orders').send(body);
    expect(res.status).toBe(400);
  });

  it('should reject quantity=0', async () => {
    const res = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 0 });
    expect(res.status).toBe(400);
  });

  it('should reject quantity=6 (over max)', async () => {
    const res = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 6 });
    expect(res.status).toBe(400);
  });

  it('should reject negative ticketPrice', async () => {
    const res = await request(app).post('/api/orders').send({ ...VALID_ORDER, ticketPrice: -1 });
    expect(res.status).toBe(400);
  });

  // ─── Happy Path ───────────────────────────────────────────

  it('should create order with status PENDING and return paymentLink', async () => {
    const res = await request(app).post('/api/orders').send(VALID_ORDER);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.orderCode).toBeDefined();
    expect(res.body.data.paymentLink).toContain('https://');
    expect(res.body.data.totalAmount).toBe(300000);
    expect(res.body.data.expiresAt).toBeDefined();
  });

  it('should create correct number of tickets with UUID', async () => {
    const res = await request(app).post('/api/orders').send(VALID_ORDER);
    expect(res.status).toBe(201);

    const tickets = await Ticket.find({ orderCode: res.body.data.orderCode });
    expect(tickets).toHaveLength(2);
    tickets.forEach((t) => {
      expect(t.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/); // UUID v4
      expect(t.status).toBe('HOLDING');
      expect(t.buyerEmail).toBe('vana@gmail.com');
    });
  });

  it('should atomically increment counter.sold', async () => {
    await request(app).post('/api/orders').send(VALID_ORDER);

    const counter = await Counter.findById('ticket_capacity');
    expect(counter!.sold).toBe(2);
  });

  // ─── Capacity / Overselling ───────────────────────────────

  it('should reject when fully sold out', async () => {
    await Counter.updateOne({ _id: 'ticket_capacity' }, { sold: 400 });

    const res = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
  });

  it('should reject when not enough remaining', async () => {
    await Counter.updateOne({ _id: 'ticket_capacity' }, { sold: 399 });

    const res = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
    expect(res.body.error.message).toContain('1'); // "Chỉ còn lại 1 vé"
  });

  it('should allow booking exactly the last ticket', async () => {
    await Counter.updateOne({ _id: 'ticket_capacity' }, { sold: 399 });

    const res = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 });
    expect(res.status).toBe(201);

    const counter = await Counter.findById('ticket_capacity');
    expect(counter!.sold).toBe(400);
  });

  // ─── Concurrent Overselling ───────────────────────────────

  it('should prevent overselling under concurrent requests', async () => {
    await Counter.updateOne({ _id: 'ticket_capacity' }, { sold: 398 });

    // Fire 5 concurrent requests for 1 ticket each (only 2 should succeed)
    const promises = Array.from({ length: 5 }, () =>
      request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 })
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status === 409);

    expect(successes.length).toBe(2);
    expect(failures.length).toBe(3);

    const counter = await Counter.findById('ticket_capacity');
    expect(counter!.sold).toBe(400);
  });
});

describe('GET /api/orders/:orderCode/status', () => {
  beforeAll(async () => await setupTestDb());
  afterEach(async () => await clearTestDb());
  afterAll(async () => await teardownTestDb());

  it('should return 400 for non-numeric orderCode', async () => {
    const res = await request(app).get('/api/orders/abc/status');
    expect(res.status).toBe(400);
  });

  it('should return 404 for non-existent order', async () => {
    const res = await request(app).get('/api/orders/999999/status');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('should return order status for existing order', async () => {
    // Create an order first
    const createRes = await request(app).post('/api/orders').send(VALID_ORDER);
    const orderCode = createRes.body.data.orderCode;

    const res = await request(app).get(`/api/orders/${orderCode}/status`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.orderCode).toBe(orderCode);
    expect(res.body.data.paidAt).toBeNull();
  });
});
