import type { Request, Response } from 'express'
import * as statsService from '../services/stats.service'
import { ok } from '../utils/response'

export async function overview(_req: Request, res: Response) {
  const data = await statsService.getOverview()
  return ok(res, data)
}

export async function me(req: Request, res: Response) {
  const data = await statsService.getMyStats(req.user!)
  return ok(res, data)
}
