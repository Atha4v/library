import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import config from '../config'
import * as authService from '../services/auth.service'
import { fail } from '../utils/response'

function getToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = getToken(req)
    if (!token) return fail(res, 401, 'Authentication required', 'UNAUTHORIZED')

    const payload = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload
    const user = await authService.findUserById(String(payload.sub))
    if (!user) return fail(res, 401, 'User not found', 'UNAUTHORIZED')

    req.user = user
    next()
  } catch {
    return fail(res, 401, 'Invalid or expired token', 'UNAUTHORIZED')
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return fail(res, 403, 'Admin access required', 'FORBIDDEN')
  }
  next()
}
