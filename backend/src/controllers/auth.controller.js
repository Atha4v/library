const authService = require('../services/auth.service')
const { ok } = require('../utils/response')

async function register(req, res) {
  const data = await authService.register(req.body)
  return ok(res, data, 'Registered successfully', 201)
}

async function login(req, res) {
  const data = await authService.login(req.body)
  return ok(res, data, 'Logged in successfully')
}

async function me(req, res) {
  return ok(res, req.user, 'Current user')
}

module.exports = { register, login, me }
