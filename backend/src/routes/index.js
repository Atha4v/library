const express = require('express')
const authRoutes = require('./auth.routes')
const usersRoutes = require('./users.routes')
const booksRoutes = require('./books.routes')
const borrowsRoutes = require('./borrows.routes')
const statsRoutes = require('./stats.routes')

const router = express.Router()

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok' }, message: 'Shelfmark API', error: null })
})

router.use('/auth', authRoutes)
router.use('/users', usersRoutes)
router.use('/books', booksRoutes)
router.use('/borrows', borrowsRoutes)
router.use('/stats', statsRoutes)

module.exports = router
