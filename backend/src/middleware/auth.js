const jwt = require('jsonwebtoken')
const { fail } = require('../utils/response')
const { getDb } = require('../db')
const { mapUser } = require('../utils/mappers')

function getToken(req) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7)
}

async function authenticate(req, res, next) {
  try {
    const token = getToken(req)
    if (!token) return fail(res, 401, 'Authentication required', 'UNAUTHORIZED')

    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const db = getDb()
    const result = await db.query(
      'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
      [payload.sub],
    )
    const user = result.rows[0]
    if (!user) return fail(res, 401, 'User not found', 'UNAUTHORIZED')

    req.user = mapUser(user)
    next()
  } catch {
    return fail(res, 401, 'Invalid or expired token', 'UNAUTHORIZED')
  }
}

function optionalAuth(req, _res, next) {
  const token = getToken(req)
  if (!token) return next()

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) return next()
    try {
      const db = getDb()
      const result = await db.query(
        'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
        [payload.sub],
      )
      if (result.rows[0]) req.user = mapUser(result.rows[0])
    } catch {
      // ignore
    }
    next()
  })
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return fail(res, 403, 'Admin access required', 'FORBIDDEN')
  }
  next()
}

module.exports = { authenticate, optionalAuth, requireAdmin }
