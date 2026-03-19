import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async Express handler so thrown errors and rejected
 * promises are automatically forwarded to the error handler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
