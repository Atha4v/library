import config from './src/config'
import { createApp } from './src/app'
import { connectDb, getDbMode } from './src/db'

async function start() {
  await connectDb()
  const app = createApp()

  app.listen(config.port, () => {
    console.log(`Shelfmark API on http://localhost:${config.port}`)
    console.log(`Database mode: ${getDbMode()}`)
    console.log(`CORS origin: ${config.clientOrigin}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
