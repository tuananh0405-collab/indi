import { db, initDatabase, events, ticketTypes, promoCodes } from './index';
import { eq } from 'drizzle-orm';

function seed(): void {
  // Ensure tables exist
  initDatabase();

  // Check if event already exists
  const existing = db.select().from(events).where(eq(events.id, 1)).get();
  if (existing) {
    console.log('⚠️  Database already seeded. Skipping.');
    return;
  }

  // Create the default event
  const event = db.insert(events).values({
    name: 'INDI INDI — Luồng Nghiệp Vụ',
    date: '2026-05-15',
    location: 'Ho Chi Minh City',
    capacity: 400,
  }).returning().get();

  console.log(`🎪 Created event: ${event.name} (ID: ${event.id})`);

  // Create 3 ticket types
  const types = [
    { eventId: event.id, name: 'EARLY_BIRD', label: 'Early Bird', price: 1000, capacity: 100, sortOrder: 1 },
    { eventId: event.id, name: 'STANDARD',   label: 'Standard',   price: 2000, capacity: 200, sortOrder: 2 },
    { eventId: event.id, name: 'VIP',        label: 'VIP',        price: 3000, capacity: 100, sortOrder: 3 },
  ];

  for (const t of types) {
    const tt = db.insert(ticketTypes).values(t).returning().get();
    console.log(`  🎟️  ${tt.label}: ${tt.price.toLocaleString()}đ (cap: ${tt.capacity})`);
  }

  // Create test promo codes
  const promos = [
    { code: 'INDI20',   discountType: 'percent', discountValue: 20,   maxUses: 50,   minOrderAmount: 0 },
    { code: 'FLAT500',  discountType: 'fixed',   discountValue: 500,  maxUses: 100,  minOrderAmount: 1000 },
    { code: 'VIP100',   discountType: 'percent', discountValue: 100,  maxUses: 2,    minOrderAmount: 0 },
  ];

  for (const p of promos) {
    const pc = db.insert(promoCodes).values(p).returning().get();
    console.log(`  🏷️  ${pc.code}: ${pc.discountType === 'percent' ? pc.discountValue + '%' : pc.discountValue + 'đ'} off (max ${pc.maxUses} uses)`);
  }

  console.log('\n✅ Seed complete!');
}

seed();
