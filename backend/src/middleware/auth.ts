import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

export function requireCoach(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'COACH' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Accès réservé au staff' });
    }
    next();
  });
}
