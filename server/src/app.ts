import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config.js';
import { db } from './db/index.js';
import { errorHandler, notFoundHandler, rateLimit } from './middleware/error.js';
import { attachUser } from './middleware/auth.js';
import { handler } from './lib/http.js';
import { authRouter } from './modules/auth.js';
import { companiesRouter, disclaimer } from './modules/companies.js';
import { practiceRouter } from './modules/practice.js';
import { attemptsRouter, mockTestsRouter } from './modules/mocktests.js';
import { codingRouter } from './modules/coding.js';
import {
  dashboardRouter,
  gamificationRouter,
  performanceRouter,
  roadmapRouter,
} from './modules/dashboard.js';
import { adminRouter } from './modules/admin.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CORS is resolved per request so a same-origin browser load always passes.
  // This matters because <script type="module"> is fetched in CORS mode, so the
  // browser sends an Origin header even when the client is served by this very
  // process — a static allow-list alone would reject the app's own bundle.
  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      // No Origin at all (curl, server-to-server, plain navigation): allow.
      if (!origin) return callback(null, { origin: true, credentials: true });

      const host = req.headers.host;
      const sameOrigin = host ? origin === `http://${host}` || origin === `https://${host}` : false;

      if (sameOrigin || config.clientOrigins.includes(origin)) {
        return callback(null, { origin: true, credentials: true });
      }

      // Disallowed: reply without CORS headers and let the browser block it.
      // Throwing here would turn a policy decision into a 500.
      return callback(null, { origin: false });
    }),
  );
  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());

  // Broad safety net; individual routers add tighter limits where it matters.
  app.use('/api', rateLimit({ windowMs: 60_000, max: 600 }));

  app.get(
    '/api/health',
    handler((_req, res) => {
      const questionCount = db()
        .prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM questions WHERE status = 'published'")
        .get()!.count;
      res.json({
        status: 'ok',
        env: config.env,
        time: new Date().toISOString(),
        questions: questionCount,
      });
    }),
  );

  app.get(
    '/api/meta',
    attachUser,
    handler((_req, res) => {
      const counts = db()
        .prepare<[], { companies: number; questions: number; mocks: number; topics: number }>(
          `SELECT
             (SELECT COUNT(*) FROM companies WHERE is_published = 1) AS companies,
             (SELECT COUNT(*) FROM questions WHERE status = 'published') AS questions,
             (SELECT COUNT(*) FROM mock_tests WHERE is_published = 1) AS mocks,
             (SELECT COUNT(*) FROM topics) AS topics`,
        )
        .get()!;
      const platformName = db()
        .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
        .get('platform.name');
      res.json({
        platformName: platformName?.value ?? 'PlacePrep',
        counts,
        disclaimer: disclaimer(),
        codeEngineEnabled: config.codeEngine.enabled,
      });
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/companies', companiesRouter);
  app.use('/api/practice', practiceRouter);
  app.use('/api/mock-tests', mockTestsRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/coding', codingRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/roadmap', roadmapRouter);
  app.use('/api/performance', performanceRouter);
  app.use('/api/gamification', gamificationRouter);
  app.use('/api/admin', adminRouter);

  // Serve the built client when it exists, so one process can host everything.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
