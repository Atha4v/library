require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { initDb } = require('./src/db')
const { notFound, errorHandler } = require('./src/middleware/error')

const authRoutes = require('./src/routes/auth')
const userRoutes = require('./src/routes/users')
const bookRoutes = require('./src/routes/books')
const borrowRoutes = require('./src/routes/borrows')
const statsRoutes = require('./src/routes/stats')

const app = express()
const PORT = process.env.PORT || 5000

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ data: { status: 'ok' }, message: 'Shelfmark API', error: null })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/books', bookRoutes)
app.use('/api/borrows', borrowRoutes)
app.use('/api/stats', statsRoutes)

app.use(notFound)
app.use(errorHandler)

async function start() {
  const { mode } = await initDb()
  app.listen(PORT, () => {
    console.log(`Shelfmark API on http://localhost:${PORT}`)
    console.log(`Database mode: ${mode}`)
  })
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
