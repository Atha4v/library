import express from 'express'
import cors from 'cors'
import config from './config'
import apiRoutes from './routes'
import { notFound, errorHandler } from './middleware/error.middleware'

export function createApp() {
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
