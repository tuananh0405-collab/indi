import app from './app';
import config from './config';
import { connectDatabase } from './config/database';

async function bootstrap(): Promise<void> {
  // 1. Connect to MongoDB
  await connectDatabase();

  // 2. Start Express server
  app.listen(config.port, () => {
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
