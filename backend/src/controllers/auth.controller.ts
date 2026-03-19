import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AppError } from '../utils/AppError';
import { AdminJwtPayload } from '../middlewares/auth.middleware';

const googleClient = new OAuth2Client(config.googleClientId);

/**
 * POST /api/auth/google
 *
 * Receives Google idToken from the frontend's "Sign in with Google" flow.
 * Verifies it, checks email against the ADMIN_EMAILS whitelist,
 * then issues an internal JWT for subsequent API calls.
 */
export async function googleLogin(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== 'string') {
    throw new AppError(400, 'MISSING_TOKEN', 'Google idToken là bắt buộc.');
  }

  // Step 1: Verify Google idToken
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Google token không hợp lệ hoặc đã hết hạn.');
  }

  if (!payload || !payload.email) {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Không thể lấy email từ Google token.');
  }

  // Step 2: Check email against whitelist
  const email = payload.email.toLowerCase();
  if (!config.adminEmails.includes(email)) {
    throw new AppError(
      403,
      'NOT_AUTHORIZED',
      'Email này không có quyền truy cập Admin. Liên hệ Ban Tổ Chức.'
    );
  }

  // Step 3: Issue internal JWT
  const jwtPayload = {
    email,
    name: payload.name || email,
    ...(payload.picture && { picture: payload.picture }),
  };

  const token = jwt.sign(jwtPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string & jwt.SignOptions['expiresIn'],
  });

  res.status(200).json({
    success: true,
    data: {
      token,
      admin: {
        email: jwtPayload.email,
        name: jwtPayload.name,
        picture: jwtPayload.picture,
      },
    },
  });
}
