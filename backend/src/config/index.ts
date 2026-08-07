import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') })

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET || 'shelfmark-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  db: {
    databaseUrl: (process.env.DATABASE_URL || '').trim(),
    dataDir: path.join(__dirname, '..', '..', 'data'),
  },
  sqlDir: path.join(__dirname, '..', 'sql'),
}

export default config
