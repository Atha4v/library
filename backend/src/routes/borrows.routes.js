const express = require('express')
const borrowsController = require('../controllers/borrows.controller')
const { authenticate, requireAdmin } = require('../middleware/auth.middleware')
const { asyncHandler } = require('../utils/asyncHandler')

const router = express.Router()

router.post('/', authenticate, asyncHandler(borrowsController.create))
router.get('/', authenticate, requireAdmin, asyncHandler(borrowsController.listAll))
router.get('/me', authenticate, asyncHandler(borrowsController.listMine))
router.get('/overdue', authenticate, requireAdmin, asyncHandler(borrowsController.listOverdue))
router.get('/:id', authenticate, asyncHandler(borrowsController.getById))
router.post('/:id/return', authenticate, asyncHandler(borrowsController.returnLoan))
router.post('/:id/renew', authenticate, asyncHandler(borrowsController.renew))

module.exports = router
