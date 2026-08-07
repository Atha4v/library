import type { Request, Response } from 'express'
import * as borrowsService from '../services/borrows.service'
import { ok } from '../utils/response'
import { paramId } from '../utils/params'

export async function create(req: Request, res: Response) {
  const data = await borrowsService.borrowBook(req.user!.id, req.body.bookId)
  return ok(res, data, 'Book borrowed successfully', 201)
}

export async function listAll(req: Request, res: Response) {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const data = await borrowsService.listAllLoans(status)
  return ok(res, data, 'All loans')
}

export async function listMine(req: Request, res: Response) {
  const data = await borrowsService.listMyLoans(req.user!.id)
  return ok(res, data, 'My loans')
}

export async function listOverdue(_req: Request, res: Response) {
  const data = await borrowsService.listOverdue()
  return ok(res, data, 'Overdue loans')
}

export async function getById(req: Request, res: Response) {
  const data = await borrowsService.getLoanById(paramId(req), req.user!)
  return ok(res, data, 'Loan detail')
}

export async function returnLoan(req: Request, res: Response) {
  const data = await borrowsService.returnLoan(paramId(req), req.user!)
  return ok(res, data, 'Book returned successfully')
}

export async function renew(req: Request, res: Response) {
  const data = await borrowsService.renewLoan(paramId(req), req.user!)
  return ok(res, data, 'Loan renewed')
}
