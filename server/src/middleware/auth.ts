import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { forbidden, unauthorized } from '../lib/http.js';
import type { AuthUser, Role } from '../types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ROLE_RANK: Record<Role, number> = { student: 1, faculty: 2, admin: 3, super_admin: 4 };

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: String(user.id), email: user.email, name: user.name, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn'],
  });
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.pp_token;
  return cookie ?? null;
}

/** Populates req.user when a valid token is present; never rejects. */
export const attachUser: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;
    const id = Number(payload.sub);
    if (!Number.isFinite(id)) return next();

    // Re-read the role from the database so a demotion takes effect immediately
    // rather than when the token expires.
    const row = db()
      .prepare<[number], { id: number; email: string; name: string; role: Role; is_active: number }>(
        'SELECT id, email, name, role, is_active FROM users WHERE id = ?',
      )
      .get(id);
    if (!row || row.is_active !== 1) return next();

    req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
  } catch {
    // Invalid or expired token — treat as anonymous.
  }
  return next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  return next();
};

/** Requires the caller's role to rank at or above `minimum`. */
export function requireRole(minimum: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minimum]) {
      return next(forbidden(`This action requires the ${minimum.replace('_', ' ')} role or higher`));
    }
    return next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireFaculty = requireRole('faculty');

/** Convenience accessor for handlers that run behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
