import { Router } from 'express'
import authRoutes from './auth.routes'
import usersRoutes from './users.routes'
import booksRoutes from './books.routes'
import borrowsRoutes from './borrows.routes'
import statsRoutes from './stats.routes'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok' }, message: 'Shelfmark API', error: null })
})

router.use('/auth', authRoutes)
router.use('/users', usersRoutes)
router.use('/books', booksRoutes)
router.use('/borrows', borrowsRoutes)
router.use('/stats', statsRoutes)

export default router
