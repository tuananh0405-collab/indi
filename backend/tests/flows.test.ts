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
  buyerName: 'Flow Test User',
  buyerEmail: 'flow@test.com',
  buyerPhone: '0901234567',
  quantity: 2,
  ticketPrice: 100000,
};

function buildWebhookPayload(orderCode: number) {
  return {
    code: '00',
    desc: 'success',
    success: true,
    data: {
      orderCode,
      amount: 200000,
      description: `INDI ${orderCode}`,
      accountNumber: '123456789',
      reference: 'TXN123',
      transactionDateTime: '2026-03-17 19:30:00',
      paymentLinkId: 'test-link',
      code: '00',
      desc: 'success',
    },
    signature: 'valid',
  };
}

describe('End-to-End Flows', () => {
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDb();
    adminToken = getAdminToken();
  });
  afterEach(async () => await clearTestDb());
  afterAll(async () => await teardownTestDb());

  // ═══════════════════════════════════════════════════════════
  // Flow 1: Happy Path (Book → Pay → Check-in → Dashboard)
  // ═══════════════════════════════════════════════════════════

  it('Flow 1: Complete buyer journey — book → pay → check-in → dashboard', async () => {
    // Step 1: Create order
    const createRes = await request(app).post('/api/orders').send(VALID_ORDER);
    expect(createRes.status).toBe(201);
    const { orderCode } = createRes.body.data;

    // Step 2: Verify order is PENDING
    const statusRes1 = await request(app).get(`/api/orders/${orderCode}/status`);
    expect(statusRes1.body.data.status).toBe('PENDING');

    // Step 3: Simulate payment webhook
    const webhookRes = await request(app)
      .post('/api/webhooks/payos')
      .send(buildWebhookPayload(orderCode));
    expect(webhookRes.status).toBe(200);

    // Step 4: Verify order is now PAID
    const statusRes2 = await request(app).get(`/api/orders/${orderCode}/status`);
    expect(statusRes2.body.data.status).toBe('PAID');
    expect(statusRes2.body.data.paidAt).not.toBeNull();

    // Step 5: Verify tickets are ACTIVE with UUIDs
    const tickets = await Ticket.find({ orderCode });
    expect(tickets).toHaveLength(2);
    tickets.forEach((t) => {
      expect(t.status).toBe('ACTIVE');
      expect(t.uuid).toBeDefined();
    });

    // Step 6: Check in first ticket
    const checkinRes = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: tickets[0].uuid });
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.body.data.checkedIn).toBe(true);

    // Step 7: Verify dashboard reflects the check-in
    const dashRes = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dashRes.body.data.sold).toBe(2);
    expect(dashRes.body.data.checkedIn).toBe(1);
    expect(dashRes.body.data.activeTickets).toBe(2);
  });

  // ═══════════════════════════════════════════════════════════
  // Flow 2: Webhook Idempotency
  // ═══════════════════════════════════════════════════════════

  it('Flow 2: Duplicate webhook does not double-process', async () => {
    const createRes = await request(app).post('/api/orders').send(VALID_ORDER);
    const { orderCode } = createRes.body.data;
    const payload = buildWebhookPayload(orderCode);

    // Send webhook twice
    await request(app).post('/api/webhooks/payos').send(payload);
    await request(app).post('/api/webhooks/payos').send(payload);

    // Only 1 order, still PAID (not double-updated)
    const order = await Order.findOne({ orderCode });
    expect(order!.status).toBe('PAID');

    // Exactly 2 tickets (not duplicated)
    const tickets = await Ticket.find({ orderCode });
    expect(tickets).toHaveLength(2);
  });

  // ═══════════════════════════════════════════════════════════
  // Flow 3: Admin Toggle → Check-in Blocked → Unblock
  // ═══════════════════════════════════════════════════════════

  it('Flow 3: Toggle off blocks check-in, toggle on allows it', async () => {
    // Create paid order
    const createRes = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 });
    const { orderCode } = createRes.body.data;
    await request(app).post('/api/webhooks/payos').send(buildWebhookPayload(orderCode));

    const ticket = await Ticket.findOne({ orderCode });

    // Toggle ACTIVE → INACTIVE
    const toggleOffRes = await request(app)
      .patch(`/api/admin/tickets/${ticket!._id}/toggle-status`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(toggleOffRes.body.data.ticket.status).toBe('INACTIVE');

    // Check-in should be BLOCKED
    const blockedRes = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: ticket!.uuid });
    expect(blockedRes.status).toBe(403);

    // Toggle INACTIVE → ACTIVE
    await request(app)
      .patch(`/api/admin/tickets/${ticket!._id}/toggle-status`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Check-in should now WORK
    const allowedRes = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: ticket!.uuid });
    expect(allowedRes.status).toBe(200);
    expect(allowedRes.body.data.checkedIn).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════
  // Flow 4: Dashboard + Export Consistency
  // ═══════════════════════════════════════════════════════════

  it('Flow 4: Dashboard stats and CSV export match reality', async () => {
    // Create 2 paid orders (3 tickets) + 1 unpaid (1 ticket HOLDING)
    const order1 = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 2 });
    const order2 = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 });
    const order3 = await request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 });

    // Pay orders 1 and 2
    await request(app).post('/api/webhooks/payos').send(buildWebhookPayload(order1.body.data.orderCode));
    await request(app).post('/api/webhooks/payos').send(buildWebhookPayload(order2.body.data.orderCode));
    // order3 stays PENDING/HOLDING

    // Check-in one ticket from order1
    const activeTicket = await Ticket.findOne({ orderCode: order1.body.data.orderCode });
    await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: activeTicket!.uuid });

    // Dashboard check
    const dashRes = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dashRes.body.data.sold).toBe(4); // 2+1+1
    expect(dashRes.body.data.activeTickets).toBe(3); // 2+1 (paid tickets)
    expect(dashRes.body.data.holdingTickets).toBe(1); // order3
    expect(dashRes.body.data.checkedIn).toBe(1);

    // Export CSV — filter ACTIVE only
    const csvRes = await request(app)
      .get('/api/admin/export?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    const lines = csvRes.text.trim().split('\n');
    expect(lines.length).toBe(4); // header + 3 ACTIVE tickets
  });

  // ═══════════════════════════════════════════════════════════
  // Flow 5: Concurrent Overselling Stress Test
  // ═══════════════════════════════════════════════════════════

  it('Flow 5: Exactly N tickets sold under concurrency (no overselling)', async () => {
    // Set capacity to only 3 remaining
    await Counter.updateOne({ _id: 'ticket_capacity' }, { sold: 397 });

    // Fire 10 concurrent requests for 1 ticket each
    const promises = Array.from({ length: 10 }, () =>
      request(app).post('/api/orders').send({ ...VALID_ORDER, quantity: 1 })
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status === 409);

    // Exactly 3 should succeed
    expect(successes.length).toBe(3);
    expect(failures.length).toBe(7);

    // Counter must be exactly 400
    const counter = await Counter.findById('ticket_capacity');
    expect(counter!.sold).toBe(400);

    // DB should have exactly 3 orders and 3 tickets
    const orders = await Order.countDocuments({});
    const tickets = await Ticket.countDocuments({});
    expect(orders).toBe(3);
    expect(tickets).toBe(3);
  });
});
