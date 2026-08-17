import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'error',
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, 'bad_request', details);
export const unauthorized = (msg = 'Authentication required') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'You do not have access to this resource') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Not found') => new HttpError(404, msg, 'not_found');
export const conflict = (msg: string) => new HttpError(409, msg, 'conflict');

/** Wraps an async handler so rejections reach the error middleware. */
export function handler(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parse<S extends ZodTypeAny>(schema: S, payload: unknown): z.infer<S> {
  try {
    return schema.parse(payload) as z.infer<S>;
  } catch (error) {
    if (error instanceof ZodError) {
      throw badRequest(
        'Request validation failed',
        error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    throw error;
  }
}
