const jwt = require('jsonwebtoken')
const config = require('../config')
const authService = require('../services/auth.service')
const { fail } = require('../utils/response')

function getToken(req) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

async function authenticate(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return fail(res, 401, 'Authentication required', 'UNAUTHORIZED')

    const payload = jwt.verify(token, config.jwt.secret)
    const user = await authService.findUserById(payload.sub)
    if (!user) return fail(res, 401, 'User not found', 'UNAUTHORIZED')

    req.user = user
    next()
  } catch {
    return fail(res, 401, 'Invalid or expired token', 'UNAUTHORIZED')
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return fail(res, 403, 'Admin access required', 'FORBIDDEN')
  }
  next()
}

module.exports = { authenticate, requireAdmin }
