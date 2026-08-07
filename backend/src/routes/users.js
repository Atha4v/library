const express = require('express')
const { getDb } = require('../db')
const { ok, fail } = require('../utils/response')
const { mapUser } = require('../utils/mappers')
const { authenticate, requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.use(authenticate, requireAdmin)

router.get('/', async (_req, res, next) => {
  try {
    const db = getDb()
    const result = await db.query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users ORDER BY created_at DESC`,
    )
    return ok(res, result.rows.map(mapUser), 'Users list')
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb()
    const result = await db.query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id],
    )
    if (!result.rows[0]) return fail(res, 404, 'User not found', 'NOT_FOUND')
    return ok(res, mapUser(result.rows[0]), 'User detail')
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const { name, role } = req.body
    if (!name && !role) {
      return fail(res, 400, 'Nothing to update', 'VALIDATION')
    }
    if (role && !['admin', 'member'].includes(role)) {
      return fail(res, 400, 'Role must be admin or member', 'VALIDATION')
    }

    const db = getDb()
    const result = await db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           role = COALESCE($2, role),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, role, created_at, updated_at`,
      [name?.trim() || null, role || null, req.params.id],
    )
    if (!result.rows[0]) return fail(res, 404, 'User not found', 'NOT_FOUND')
    return ok(res, mapUser(result.rows[0]), 'User updated')
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.id === req.params.id) {
      return fail(res, 400, 'Cannot delete your own account', 'VALIDATION')
    }
    const db = getDb()
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.params.id],
    )
    if (!result.rows[0]) return fail(res, 404, 'User not found', 'NOT_FOUND')
    return ok(res, { id: req.params.id }, 'User deleted')
  } catch (err) {
    next(err)
  }
})

module.exports = router
