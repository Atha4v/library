const { fail } = require('../utils/response')

function notFound(_req, res) {
  return fail(res, 404, 'Route not found', 'NOT_FOUND')
}

function errorHandler(err, _req, res, _next) {
  console.error(err)

  if (err.code === '23505') {
    return fail(res, 409, 'Duplicate value', 'CONFLICT')
  }
  if (err.code === '23503') {
    return fail(res, 400, 'Related record not found', 'FK_VIOLATION')
  }

  return fail(res, err.status || 500, err.message || 'Server error', err.code || 'SERVER_ERROR')
}

module.exports = { notFound, errorHandler }
