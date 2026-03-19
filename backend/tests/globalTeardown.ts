import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Global teardown — stops the in-memory MongoDB instance.
 */
export default async function globalTeardown() {
  const mongod: MongoMemoryServer = (global as any).__MONGOD__;
  if (mongod) {
    await mongod.stop();
    console.log('\n🧪 Test MongoDB stopped\n');
  }
}
