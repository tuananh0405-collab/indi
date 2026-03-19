import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Global setup — starts an in-memory MongoDB instance
 * and sets the URI as a global env variable for all tests.
 */
export default async function globalSetup() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Store the instance and URI for teardown + test consumption
  (global as any).__MONGOD__ = mongod;
  process.env.MONGODB_URI = uri;

  // Set test env vars that config/index.ts requires
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_API_KEY = 'test-key';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.ADMIN_EMAILS = 'admin@test.com,admin2@test.com';
  process.env.PAYOS_CLIENT_ID = 'test-payos-client';
  process.env.PAYOS_API_KEY = 'test-payos-api-key';
  process.env.PAYOS_CHECKSUM_KEY = 'test-payos-checksum';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASS = 'test';
  process.env.SMTP_FROM_EMAIL = 'test@test.com';
  process.env.TICKET_CAPACITY = '400';
  process.env.ORDER_TTL_MINUTES = '10';
  process.env.FRONTEND_URL = 'http://localhost:5173';

  console.log(`\n🧪 Test MongoDB started: ${uri}\n`);
}
