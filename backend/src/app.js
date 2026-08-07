const express = require('express')
const cors = require('cors')
const config = require('./config')
const apiRoutes = require('./routes')
const { notFound, errorHandler } = require('./middleware/error.middleware')

function createApp() {
  const app = express()

  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  )
  app.use(express.json())

  app.use('/api', apiRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

module.exports = { createApp }
