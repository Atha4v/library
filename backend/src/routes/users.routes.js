const express = require('express')
const usersController = require('../controllers/users.controller')
const { authenticate, requireAdmin } = require('../middleware/auth.middleware')
const { asyncHandler } = require('../utils/asyncHandler')

const router = express.Router()

router.use(authenticate, requireAdmin)

router.get('/', asyncHandler(usersController.list))
router.get('/:id', asyncHandler(usersController.getById))
router.patch('/:id', asyncHandler(usersController.update))
router.delete('/:id', asyncHandler(usersController.remove))

module.exports = router
