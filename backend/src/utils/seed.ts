/**
 * Seed script — initializes the ticket_capacity Counter document.
 *
 * Usage:  npm run seed
 */
import mongoose from 'mongoose';
import config from '../config';
import Counter from '../models/Counter';

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  await mongoose.connect(config.mongodbUri);
  console.log('✅ MongoDB connected');

  // Upsert the capacity counter — safe to re-run
  const result = await Counter.findOneAndUpdate(
    { _id: 'ticket_capacity' },
    {
      $setOnInsert: {
        total: config.ticketCapacity,
        sold: 0,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`✅ Counter document ready:`, {
    id: result._id,
    total: result.total,
    sold: result.sold,
    available: result.total - result.sold,
  });

  await mongoose.disconnect();
  console.log('🌱 Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
