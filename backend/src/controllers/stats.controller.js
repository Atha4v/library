const statsService = require('../services/stats.service')
const { ok } = require('../utils/response')

async function overview(_req, res) {
  const data = await statsService.getOverview()
  return ok(res, data)
}

async function me(req, res) {
  const data = await statsService.getMyStats(req.user)
  return ok(res, data)
}

module.exports = { overview, me }
