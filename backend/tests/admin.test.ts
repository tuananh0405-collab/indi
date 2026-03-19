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

describe('Admin APIs', () => {
  beforeAll(async () => {
    await setupTestDb();
    adminToken = getAdminToken();
  });
  afterEach(async () => await clearTestDb());
  afterAll(async () => await teardownTestDb());

  // ═══════════════════════════════════════════════════════════
  // Auth Guard
  // ═══════════════════════════════════════════════════════════

  describe('Auth Guard', () => {
    it('should reject all admin endpoints without token', async () => {
      const endpoints = [
        { method: 'get', path: '/api/admin/tickets' },
        { method: 'get', path: '/api/admin/dashboard' },
        { method: 'get', path: '/api/admin/export' },
      ];

      for (const ep of endpoints) {
        const res = await (request(app) as any)[ep.method](ep.path);
        expect(res.status).toBe(401);
      }
    });

    it('should reject with invalid token', async () => {
      const res = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', 'Bearer invalid-jwt-token');
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // GET /api/admin/tickets
  // ═══════════════════════════════════════════════════════════

  describe('GET /api/admin/tickets', () => {
    it('should list all tickets with pagination', async () => {
      await createTestOrder({ status: 'PAID', quantity: 3, buyerEmail: 'user1@test.com' });
      await createTestOrder({ status: 'PAID', quantity: 2, buyerEmail: 'user2@test.com' });

      const res = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toHaveLength(5);
      expect(res.body.data.pagination.total).toBe(5);
    });

    it('should search by email', async () => {
      await createTestOrder({ status: 'PAID', quantity: 1, buyerEmail: 'findme@test.com' });
      await createTestOrder({ status: 'PAID', quantity: 1, buyerEmail: 'other@test.com' });

      const res = await request(app)
        .get('/api/admin/tickets?search=findme')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toHaveLength(1);
      expect(res.body.data.tickets[0].buyerEmail).toBe('findme@test.com');
    });

    it('should filter by status', async () => {
      await createTestOrder({ status: 'PAID', quantity: 2 });
      await createTestOrder({ quantity: 1 }); // HOLDING

      const res = await request(app)
        .get('/api/admin/tickets?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toHaveLength(2);
      res.body.data.tickets.forEach((t: any) => expect(t.status).toBe('ACTIVE'));
    });

    it('should paginate correctly', async () => {
      await createTestOrder({ status: 'PAID', quantity: 5 });

      const res = await request(app)
        .get('/api/admin/tickets?page=2&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tickets).toHaveLength(2);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PATCH /api/admin/tickets/:id
  // ═══════════════════════════════════════════════════════════

  describe('PATCH /api/admin/tickets/:id', () => {
    it('should reject empty body', async () => {
      const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });

      const res = await request(app)
        .patch(`/api/admin/tickets/${tickets[0]._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should update buyer info', async () => {
      const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });

      const res = await request(app)
        .patch(`/api/admin/tickets/${tickets[0]._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ buyerName: 'Updated Name', buyerPhone: '0999999999' });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.buyerName).toBe('Updated Name');
      expect(res.body.data.ticket.buyerPhone).toBe('0999999999');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PATCH /api/admin/tickets/:id/toggle-status
  // ═══════════════════════════════════════════════════════════

  describe('PATCH /api/admin/tickets/:id/toggle-status', () => {
    it('should toggle ACTIVE → INACTIVE', async () => {
      const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });

      const res = await request(app)
        .patch(`/api/admin/tickets/${tickets[0]._id}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe('INACTIVE');
    });

    it('should toggle INACTIVE → ACTIVE', async () => {
      const { tickets } = await createTestOrder({ status: 'PAID', quantity: 1 });
      await Ticket.updateOne({ _id: tickets[0]._id }, { status: 'INACTIVE' });

      const res = await request(app)
        .patch(`/api/admin/tickets/${tickets[0]._id}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe('ACTIVE');
    });

    it('should reject toggle for HOLDING ticket', async () => {
      const { tickets } = await createTestOrder({ quantity: 1 }); // HOLDING

      const res = await request(app)
        .patch(`/api/admin/tickets/${tickets[0]._id}/toggle-status`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATUS');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // GET /api/admin/dashboard
  // ═══════════════════════════════════════════════════════════

  describe('GET /api/admin/dashboard', () => {
    it('should return correct stats', async () => {
      // 2 paid tickets (ACTIVE) + 1 holding ticket
      await createTestOrder({ status: 'PAID', quantity: 2 });
      await createTestOrder({ quantity: 1 }); // HOLDING

      // Check in one
      const activeTicket = await Ticket.findOne({ status: 'ACTIVE' });
      await Ticket.updateOne({ _id: activeTicket!._id }, { checkedIn: true });

      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.capacity).toBe(400);
      expect(res.body.data.sold).toBe(3);
      expect(res.body.data.available).toBe(397);
      expect(res.body.data.activeTickets).toBe(2);
      expect(res.body.data.holdingTickets).toBe(1);
      expect(res.body.data.checkedIn).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // GET /api/admin/export
  // ═══════════════════════════════════════════════════════════

  describe('GET /api/admin/export', () => {
    it('should return CSV with correct headers', async () => {
      await createTestOrder({ status: 'PAID', quantity: 2 });

      const res = await request(app)
        .get('/api/admin/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('tickets_export_');

      const csvBody = res.text;
      expect(csvBody).toContain('UUID');
      expect(csvBody).toContain('Order Code');
      expect(csvBody).toContain('Buyer Name');
    });

    it('should filter by status', async () => {
      await createTestOrder({ status: 'PAID', quantity: 2 });
      await createTestOrder({ quantity: 1 }); // HOLDING

      const res = await request(app)
        .get('/api/admin/export?status=ACTIVE')
        .set('Authorization', `Bearer ${adminToken}`);

      // CSV should only have header + 2 ACTIVE rows (not the HOLDING one)
      const lines = res.text.trim().split('\n');
      expect(lines.length).toBe(3); // header + 2 data rows
    });
  });
});
