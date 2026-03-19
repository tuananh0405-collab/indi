/**
 * Mock PayOS service for testing.
 * Replaces the real PayOS SDK so tests don't need real API keys.
 */
const mockPayos = {
  createPaymentLink: jest.fn().mockResolvedValue({
    checkoutUrl: 'https://pay.payos.vn/web/test-checkout',
    paymentLinkId: 'test-payment-link-id',
  }),

  verifyPaymentWebhookData: jest.fn().mockImplementation((body: any) => {
    // Simulate: if signature is 'invalid', throw
    if (body.signature === 'invalid') {
      throw new Error('Invalid checksum');
    }
    // Otherwise return the data payload
    return body.data;
  }),

  cancelPaymentLink: jest.fn().mockResolvedValue({}),
};

export default mockPayos;
