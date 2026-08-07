import { Router } from 'express'
import * as borrowsController from '../controllers/borrows.controller'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/', authenticate, asyncHandler(borrowsController.create))
router.get('/', authenticate, requireAdmin, asyncHandler(borrowsController.listAll))
router.get('/me', authenticate, asyncHandler(borrowsController.listMine))
router.get(
  '/overdue',
  authenticate,
  requireAdmin,
  asyncHandler(borrowsController.listOverdue),
)
router.get('/:id', authenticate, asyncHandler(borrowsController.getById))
router.post('/:id/return', authenticate, asyncHandler(borrowsController.returnLoan))
router.post('/:id/renew', authenticate, asyncHandler(borrowsController.renew))

export default router
