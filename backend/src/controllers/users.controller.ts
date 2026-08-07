import type { Request, Response } from 'express'
import * as usersService from '../services/users.service'
import { ok } from '../utils/response'
import { paramId } from '../utils/params'

export async function list(_req: Request, res: Response) {
  const data = await usersService.listUsers()
  return ok(res, data, 'Users list')
}

export async function getById(req: Request, res: Response) {
  const data = await usersService.getUserById(paramId(req))
  return ok(res, data, 'User detail')
}

export async function update(req: Request, res: Response) {
  const data = await usersService.updateUser(paramId(req), req.body)
  return ok(res, data, 'User updated')
}

export async function remove(req: Request, res: Response) {
  const data = await usersService.deleteUser(paramId(req), req.user!.id)
  return ok(res, data, 'User deleted')
}
