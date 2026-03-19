import app from './app';
import config from './config';
import { connectDatabase } from './config/database';
import { startTtlCleanupJob } from './jobs/ttlCleanup';

async function bootstrap(): Promise<void> {
  // 1. Connect to MongoDB
  await connectDatabase();

  // 2. Start TTL cleanup job (expires unpaid orders every 60s)
  startTtlCleanupJob();

  // 3. Start Express server
  const host = config.nodeEnv === 'production' ? '0.0.0.0' : 'localhost';
  app.listen(config.port, host, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   🎫 INDI Ticketing API                     ║
║   Environment : ${config.nodeEnv.padEnd(28)}║
║   Port        : ${String(config.port).padEnd(28)}║
║   Health      : http://localhost:${config.port}/health   ║
╚══════════════════════════════════════════════╝
    `);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
