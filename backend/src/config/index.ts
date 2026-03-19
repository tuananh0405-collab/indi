import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  port: number;
  nodeEnv: string;
  mongodbUri: string;

  // Admin Auth (Google OAuth2 → JWT)
  googleClientId: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  adminEmails: string[];

  payos: {
    clientId: string;
    apiKey: string;
    checksumKey: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
  };
  ticketCapacity: number;
  orderTtlMinutes: number;
  frontendUrl: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
  return value;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: requireEnv('MONGODB_URI'),

  // Admin Auth
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  adminEmails: requireEnv('ADMIN_EMAILS')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  payos: {
    clientId: requireEnv('PAYOS_CLIENT_ID'),
    apiKey: requireEnv('PAYOS_API_KEY'),
    checksumKey: requireEnv('PAYOS_CHECKSUM_KEY'),
  },
  smtp: {
    host: requireEnv('SMTP_HOST'),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: requireEnv('SMTP_USER'),
    pass: requireEnv('SMTP_PASS'),
    fromName: process.env.SMTP_FROM_NAME || 'INDI Event',
    fromEmail: requireEnv('SMTP_FROM_EMAIL'),
  },
  ticketCapacity: parseInt(process.env.TICKET_CAPACITY || '400', 10),
  orderTtlMinutes: parseInt(process.env.ORDER_TTL_MINUTES || '10', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

export default config;
