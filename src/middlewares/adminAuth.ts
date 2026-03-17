import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { AppError } from '../utils/AppError';

/**
 * Middleware to protect Admin & Check-in routes.
 * Validates the `x-admin-api-key` header against the static key in env.
 */
export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-admin-api-key'] as string | undefined;

  if (!apiKey || apiKey !== config.adminApiKey) {
    throw new AppError(401, 'UNAUTHORIZED', 'API key không hợp lệ hoặc bị thiếu.');
  }

  next();
}
