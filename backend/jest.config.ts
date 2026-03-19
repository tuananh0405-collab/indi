import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Global setup/teardown for mongodb-memory-server
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  // Module path mapping for mocks
  moduleNameMapper: {
    '^../services/payos.service$': '<rootDir>/tests/__mocks__/payos.service.ts',
  },
  // Timeout for slow in-memory DB operations
  testTimeout: 30000,
  // Run tests sequentially (shared DB state)
  maxWorkers: 1,
  verbose: true,
};

export default config;
