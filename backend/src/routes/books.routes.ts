import { Router } from 'express'
import * as booksController from '../controllers/books.controller'
import { authenticate, requireAdmin } from '../middleware/auth.middleware'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get('/', asyncHandler(booksController.list))
router.get('/:id', asyncHandler(booksController.getById))
router.post('/', authenticate, requireAdmin, asyncHandler(booksController.create))
router.put('/:id', authenticate, requireAdmin, asyncHandler(booksController.update))
router.delete('/:id', authenticate, requireAdmin, asyncHandler(booksController.remove))

export default router
