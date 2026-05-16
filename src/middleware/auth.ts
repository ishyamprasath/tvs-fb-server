import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/auth.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const token = authorization.replace('Bearer ', '');

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (req.user.email !== 'admin@tvsd.ai') {
    return res.status(403).json({ message: 'You do not have access to this resource.' });
  }

  return next();
}
