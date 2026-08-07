class AppError extends Error {
  constructor(message, status = 500, code = 'SERVER_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

module.exports = { AppError }
