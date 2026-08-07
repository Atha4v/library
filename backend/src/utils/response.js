function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ data, message, error: null })
}

function fail(res, status, message, error = 'ERROR') {
  return res.status(status).json({ data: null, message, error })
}

module.exports = { ok, fail }
