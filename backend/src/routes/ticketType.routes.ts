import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, ticketTypes } from '../db';

const router = Router();

/**
 * GET /api/ticket-types
 * Public — returns available ticket types with price, remaining, and active status.
 * No authentication required.
 */
router.get('/', (_req, res) => {
  const types = db.select().from(ticketTypes)
    .where(eq(ticketTypes.eventId, 1))
    .all()
    .map((t) => ({
      id: t.id,
      name: t.name,
      label: t.label,
      price: t.price,
      capacity: t.capacity,
      sold: t.sold,
      remaining: t.capacity ? t.capacity - t.sold : null,
      active: t.active,
      sortOrder: t.sortOrder,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  res.json({ success: true, data: { ticketTypes: types } });
});

export default router;
