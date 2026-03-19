import request from 'supertest';
import app from '../src/app';
import Ticket from '../src/models/Ticket';
import { setupTestDb, clearTestDb, teardownTestDb, getAdminToken, createTestOrder } from './helpers';

// ─── Mock external services ──────────────────────────────────
jest.mock('../src/services/payos.service', () => require('./__mocks__/payos.service').default);
jest.mock('../src/services/email.service', () => ({
  sendTicketEmail: jest.fn().mockResolvedValue(undefined),
}));

let adminToken: string;

describe('POST /api/checkin', () => {
  beforeAll(async () => {
    await setupTestDb();
    adminToken = getAdminToken();
  });
  afterEach(async () => await clearTestDb());
  afterAll(async () => await teardownTestDb());

  it('should reject without auth token', async () => {
    const res = await request(app).post('/api/checkin').send({ uuid: 'test' });
    expect(res.status).toBe(401);
  });

  it('should reject missing uuid', async () => {
    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 404 for unknown UUID', async () => {
    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: '00000000-0000-4000-8000-000000000000' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('should reject check-in for HOLDING (unpaid) ticket', async () => {
    const { tickets } = await createTestOrder({ quantity: 1 });

    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: tickets[0].uuid });
    expect(res.status).toBe(410);
  });

  it('should reject check-in for INACTIVE ticket', async () => {
    const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });
    await Ticket.updateOne({ _id: tickets[0]._id }, { status: 'INACTIVE' });

    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: tickets[0].uuid });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TICKET_INACTIVE');
  });

  it('should successfully check in an ACTIVE ticket', async () => {
    const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });

    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: tickets[0].uuid });

    expect(res.status).toBe(200);
    expect(res.body.data.checkedIn).toBe(true);
    expect(res.body.data.checkedInAt).toBeDefined();
    expect(res.body.data.buyerName).toBe('Test Buyer');

    // Verify DB
    const ticket = await Ticket.findById(tickets[0]._id);
    expect(ticket!.checkedIn).toBe(true);
  });

  it('should reject double check-in', async () => {
    const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });

    // First check-in
    await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: tickets[0].uuid });

    // Second check-in
    const res = await request(app)
      .post('/api/checkin')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uuid: tickets[0].uuid });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_CHECKED_IN');
  });
});
