import PayOS from '@payos/node';
import config from '../config';

/**
 * PayOS SDK singleton instance.
 * Used for creating payment links, verifying webhooks, and cancelling links.
 */
const payos = new PayOS(
  config.payos.clientId,
  config.payos.apiKey,
  config.payos.checksumKey
);

export default payos;
