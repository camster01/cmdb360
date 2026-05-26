import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

interface JwtPayload {
  id: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; role: string };
      systemId?: string;
      effectiveRole?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: payload.id, username: payload.username, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Resolves the user's effective role for the system in X-System-ID header.
// Global admins always get 'admin'. Others look up user_system_roles.
export function resolveSystem(req: Request, res: Response, next: NextFunction): void {
  const systemId = req.headers['x-system-id'] as string | undefined;
  if (!systemId) {
    res.status(400).json({ error: 'X-System-ID header required' });
    return;
  }
  req.systemId = systemId;

  if (req.user!.role === 'admin') {
    req.effectiveRole = 'admin';
    next();
    return;
  }

  pool.query(
    'SELECT role FROM user_system_roles WHERE user_id = $1 AND system_id = $2',
    [req.user!.id, systemId]
  ).then(result => {
    if (result.rows.length === 0) {
      res.status(403).json({ error: 'No access to this system' });
      return;
    }
    req.effectiveRole = result.rows[0].role;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Internal server error' });
  });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.effectiveRole ?? req.user?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
