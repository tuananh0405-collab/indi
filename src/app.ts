import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/errorHandler';

const app: Application = express();

// ─── Global Middleware ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ─── API Routes (will be registered in subsequent steps) ─────
// app.use('/api/orders', orderRoutes);
// app.use('/api/webhooks', webhookRoutes);
// app.use('/api/checkin', checkinRoutes);
// app.use('/api/admin', adminRoutes);

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
