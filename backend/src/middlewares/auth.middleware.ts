import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AppError } from '../utils/AppError';

// ─── JWT Payload Type ─────────────────────────────────────────
export interface AdminJwtPayload {
  email: string;
  name: string;
  picture?: string;
}

// Extend Express Request to carry decoded admin info
declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

/**
 * Middleware to protect Admin & Check-in routes.
 * Expects: Authorization: Bearer <jwt>
 */
export function verifyAdminJwt(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token xác thực bị thiếu hoặc sai định dạng.');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AdminJwtPayload;
    req.admin = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Token đã hết hạn. Vui lòng đăng nhập lại.');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Token không hợp lệ.');
  }
}
