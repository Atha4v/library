import { Router } from 'express'
import * as statsController from '../controllers/stats.controller'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get(
  '/overview',
  authenticate,
  requireAdmin,
  asyncHandler(statsController.overview),
)
router.get('/me', authenticate, asyncHandler(statsController.me))

export default router
