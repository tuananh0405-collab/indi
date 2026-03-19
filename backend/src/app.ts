import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler';
import authRoutes from './routes/auth.routes';
import orderRoutes from './routes/order.routes';
import webhookRoutes from './routes/webhook.routes';
import checkinRoutes from './routes/checkin.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// ─── Global Middleware ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiters ────────────────────────────────────────────
// Strict limiter for order creation to prevent booking spam
const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.',
    },
  },
});

// ─── Health Check ─────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderLimiter, orderRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/admin', adminRoutes);

// ─── 404 Handler ──────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint không tồn tại.',
    },
  });
});

// ─── Error Handler (must be last) ─────────────────────────────
app.use(errorHandler);

export default app;
