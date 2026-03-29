import app from './app';
import config from './config';
import { connectDatabase } from './config/database';
import { seedDatabase } from './db/seed-startup';
import { startTtlCleanupJob } from './jobs/ttlCleanup';

function bootstrap(): void {
  // 1. Initialize SQLite database
  connectDatabase();

  // 2. Auto-seed if database is empty (safe for Render ephemeral FS)
  seedDatabase();

  // 3. Start TTL cleanup job (expires unpaid orders every 60s)
  startTtlCleanupJob();

  // 4. Start Express server
  const host = config.nodeEnv === 'production' ? '0.0.0.0' : 'localhost';
  app.listen(config.port, host, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🎫 INDI Ticketing API                     ║
║   Environment : ${config.nodeEnv.padEnd(28)}║
║   Port        : ${String(config.port).padEnd(28)}║
║   Database    : SQLite (WAL mode)            ║
║   Health      : http://localhost:${config.port}/health   ║
╚══════════════════════════════════════════════╝
    `);
  });
}

bootstrap();
