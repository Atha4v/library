import type { Request, Response } from 'express'
import * as booksService from '../services/books.service'
import { ok } from '../utils/response'
import { paramId } from '../utils/params'

export async function list(req: Request, res: Response) {
  const data = await booksService.listBooks(req.query as Record<string, string>)
  return ok(res, data)
}

export async function getById(req: Request, res: Response) {
  const data = await booksService.getBookById(paramId(req))
  return ok(res, data, 'Book detail')
}

export async function create(req: Request, res: Response) {
  const data = await booksService.createBook(req.body)
  return ok(res, data, 'Book created', 201)
}

export async function update(req: Request, res: Response) {
  const data = await booksService.updateBook(paramId(req), req.body)
  return ok(res, data, 'Book updated')
}

export async function remove(req: Request, res: Response) {
  const data = await booksService.deleteBook(paramId(req))
  return ok(res, data, 'Book deleted')
}
