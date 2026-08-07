const usersService = require('../services/users.service')
const { ok } = require('../utils/response')

async function list(_req, res) {
  const data = await usersService.listUsers()
  return ok(res, data, 'Users list')
}

async function getById(req, res) {
  const data = await usersService.getUserById(req.params.id)
  return ok(res, data, 'User detail')
}

async function update(req, res) {
  const data = await usersService.updateUser(req.params.id, req.body)
  return ok(res, data, 'User updated')
}

async function remove(req, res) {
  const data = await usersService.deleteUser(req.params.id, req.user.id)
  return ok(res, data, 'User deleted')
}

module.exports = { list, getById, update, remove }
