const express = require('express')
const authController = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { asyncHandler } = require('../utils/asyncHandler')

const router = express.Router()

router.post('/register', asyncHandler(authController.register))
router.post('/login', asyncHandler(authController.login))
router.get('/me', authenticate, asyncHandler(authController.me))

module.exports = router
