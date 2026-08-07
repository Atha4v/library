const express = require('express')
const booksController = require('../controllers/books.controller')
const { authenticate, requireAdmin } = require('../middleware/auth.middleware')
const { asyncHandler } = require('../utils/asyncHandler')

const router = express.Router()

router.get('/', asyncHandler(booksController.list))
router.get('/:id', asyncHandler(booksController.getById))
router.post('/', authenticate, requireAdmin, asyncHandler(booksController.create))
router.put('/:id', authenticate, requireAdmin, asyncHandler(booksController.update))
router.patch(
  '/:id/quantity',
  authenticate,
  requireAdmin,
  asyncHandler(booksController.updateQuantity),
)
router.delete('/:id', authenticate, requireAdmin, asyncHandler(booksController.remove))

module.exports = router
