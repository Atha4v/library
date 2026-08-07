const express = require('express')
const statsController = require('../controllers/stats.controller')
const { authenticate, requireAdmin } = require('../middleware/auth.middleware')
const { asyncHandler } = require('../utils/asyncHandler')

const router = express.Router()

router.get('/overview', authenticate, requireAdmin, asyncHandler(statsController.overview))
router.get('/me', authenticate, asyncHandler(statsController.me))

module.exports = router
