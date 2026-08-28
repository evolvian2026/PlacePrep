import { Router } from 'express';
import { resolveCollegeId } from '../engines/cohort.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { badRequest, conflict, handler, parse, unauthorized } from '../lib/http.js';
import { slugify } from '../lib/util.js';
import { attachUser, currentUser, requireAuth, signToken } from '../middleware/auth.js';
import { rateLimit } from '../middleware/error.js';
import type { Role } from '../types.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  college: z.string().trim().max(120).optional(),
  branch: z.string().trim().max(40).optional(),
  graduationYear: z.number().int().min(2000).max(2100).optional(),
  cgpa: z.number().min(0).max(10).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  college: z.string().trim().max(120).nullable().optional(),
  branch: z.string().trim().max(40).nullable().optional(),
  graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
  cgpa: z.number().min(0).max(10).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  college: string | null;
  branch: string | null;
  graduation_year: number | null;
  cgpa: number | null;
  phone: string | null;
  avatar_seed: string | null;
  created_at: string;
}

function publicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    college: row.college,
    branch: row.branch,
    graduationYear: row.graduation_year,
    cgpa: row.cgpa,
    phone: row.phone,
    avatarSeed: row.avatar_seed ?? slugify(row.name),
    createdAt: row.created_at,
  };
}

export const authRouter = Router();

// Brute-force protection on the credential endpoints only.
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 40 });

authRouter.post(
  '/register',
  authLimiter,
  handler((req, res) => {
    const input = parse(registerSchema, req.body);

    const existing = db()
      .prepare<[string], { id: number }>('SELECT id FROM users WHERE email = ?')
      .get(input.email);
    if (existing) throw conflict('An account with that email already exists');

    const info = db()
      .prepare(
        `INSERT INTO users (email, password_hash, name, role, college, college_id, branch, graduation_year, cgpa, avatar_seed)
         VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.email,
        bcrypt.hashSync(input.password, 10),
        input.name,
        input.college ?? null,
        // The typed name is kept as the student wrote it; the id is what makes
        // them part of a cohort.
        resolveCollegeId(input.college),
        input.branch ?? null,
        input.graduationYear ?? null,
        input.cgpa ?? null,
        slugify(input.name),
      );

    const row = db()
      .prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid))!;

    res.status(201).json({
      token: signToken({ id: row.id, email: row.email, name: row.name, role: row.role }),
      user: publicUser(row),
    });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  handler((req, res) => {
    const input = parse(loginSchema, req.body);
    const row = db().prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?').get(input.email);

    // Compare against a dummy hash when the user is absent so timing does not
    // reveal whether the email exists.
    const hash = row?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const ok = bcrypt.compareSync(input.password, hash);
    if (!row || !ok) throw unauthorized('Invalid email or password');

    db().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);

    res.json({
      token: signToken({ id: row.id, email: row.email, name: row.name, role: row.role }),
      user: publicUser(row),
    });
  }),
);

authRouter.get(
  '/me',
  attachUser,
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const row = db().prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(user.id)!;
    res.json({ user: publicUser(row) });
  }),
);

authRouter.patch(
  '/me',
  attachUser,
  requireAuth,
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(profileSchema, req.body);

    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      name: 'name',
      college: 'college',
      branch: 'branch',
      graduationYear: 'graduation_year',
      cgpa: 'cgpa',
      phone: 'phone',
    };
    for (const [key, column] of Object.entries(map)) {
      if (key in input) {
        fields.push(`${column} = ?`);
        params.push((input as Record<string, unknown>)[key] ?? null);
      }
    }
    // Keep the cohort link in step with whatever the student typed.
    if ('college' in input) {
      fields.push('college_id = ?');
      params.push(resolveCollegeId(input.college));
    }
    if (fields.length === 0) throw badRequest('No fields to update');

    db()
      .prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
      .run(...params, user.id);

    const row = db().prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(user.id)!;
    res.json({ user: publicUser(row) });
  }),
);

authRouter.post(
  '/change-password',
  attachUser,
  requireAuth,
  authLimiter,
  handler((req, res) => {
    const user = currentUser(req);
    const input = parse(passwordSchema, req.body);
    const row = db().prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(user.id)!;

    if (!bcrypt.compareSync(input.currentPassword, row.password_hash)) {
      throw unauthorized('Current password is incorrect');
    }

    db()
      .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(bcrypt.hashSync(input.newPassword, 10), user.id);

    res.json({ ok: true });
  }),
);
