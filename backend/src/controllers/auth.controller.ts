import type { Request, Response } from 'express'
import * as authService from '../services/auth.service'
import { ok } from '../utils/response'

export async function register(req: Request, res: Response) {
  const data = await authService.register(req.body)
  return ok(res, data, 'Registered successfully', 201)
}

export async function login(req: Request, res: Response) {
  const data = await authService.login(req.body)
  return ok(res, data, 'Logged in successfully')
}

export async function me(req: Request, res: Response) {
  return ok(res, req.user ?? null, 'Current user')
}
