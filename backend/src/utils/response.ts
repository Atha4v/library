import type { Response } from 'express'

export function ok<T>(
  res: Response,
  data: T | null = null,
  message = 'OK',
  status = 200,
) {
  return res.status(status).json({ data, message, error: null })
}

export function fail(
  res: Response,
  status: number,
  message: string,
  error = 'ERROR',
) {
  return res.status(status).json({ data: null, message, error })
}
