import type { NextFunction, Request, Response } from 'express'
import { fail } from '../utils/response'

export function notFound(_req: Request, res: Response) {
  return fail(res, 404, 'Route not found', 'NOT_FOUND')
}

export function errorHandler(
  err: Error & { status?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (process.env.NODE_ENV !== 'test') {
    console.error(err)
  }

  if (err.code === '23505') {
    return fail(res, 409, 'Duplicate value', 'CONFLICT')
  }
  if (err.code === '23503') {
    return fail(res, 400, 'Related record not found', 'FK_VIOLATION')
  }

  return fail(
    res,
    err.status || 500,
    err.message || 'Server error',
    err.code || 'SERVER_ERROR',
  )
}
