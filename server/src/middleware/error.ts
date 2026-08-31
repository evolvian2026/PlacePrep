import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../lib/http.js';
import { config } from '../config.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  // Middleware upstream of our handlers raises errors that already carry a
  // status — body-parser sets 400 with type 'entity.parse.failed' for a
  // malformed JSON body, for example. Reporting those as 500 blames the server
  // for the client's mistake, and logging them as unhandled buries genuine
  // faults in noise that any client can generate at will.
  const status = clientErrorStatus(error);
  if (status !== null) {
    res.status(status).json({
      error: {
        code: status === 400 ? 'bad_request' : 'request_rejected',
        message: describeClientError(error),
      },
    });
    return;
  }

  // Unexpected: log it server-side, return something safe to the client.
  console.error('[unhandled]', error);
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on the server',
      ...(config.isProduction ? {} : { details: error instanceof Error ? error.message : String(error) }),
    },
  });
};

/**
 * Reads the status off an error thrown by upstream middleware, but only when it
 * is a client error. A 5xx from middleware is still a genuine fault and must
 * keep its logging.
 */
function clientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const status = (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { statusCode?: unknown }).statusCode;
  if (typeof status !== 'number' || status < 400 || status >= 500) return null;
  return status;
}

/**
 * A short, safe description. The parser's own message quotes the offending
 * body back, which could echo a password or token into a response or a log.
 */
function describeClientError(error: unknown): string {
  const type = (error as { type?: unknown }).type;
  if (type === 'entity.parse.failed') return 'Request body is not valid JSON';
  if (type === 'entity.too.large') return 'Request body is too large';
  return 'The request could not be processed';
}

/**
 * Minimal in-memory rate limiter. Adequate for a single-process campus install;
 * a multi-instance deployment should front this with a shared store.
 */
export function rateLimit(options: { windowMs: number; max: number; key?: (req: Parameters<RequestHandler>[0]) => string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const key = options.key?.(req) ?? req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: { code: 'rate_limited', message: `Too many requests. Try again in ${retryAfter}s.` },
      });
      return;
    }

    // Opportunistic cleanup so the map cannot grow without bound.
    if (hits.size > 5000) {
      for (const [mapKey, value] of hits) {
        if (value.resetAt <= now) hits.delete(mapKey);
      }
    }

    return next();
  };
}
