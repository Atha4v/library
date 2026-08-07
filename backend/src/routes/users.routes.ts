import { Router } from 'express'
import * as usersController from '../controllers/users.controller'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/', asyncHandler(usersController.list))
router.get('/:id', asyncHandler(usersController.getById))
router.patch('/:id', asyncHandler(usersController.update))
router.delete('/:id', asyncHandler(usersController.remove))

export default router
