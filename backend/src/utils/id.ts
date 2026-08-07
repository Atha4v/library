import crypto from 'crypto'

export function newId(): string {
  return crypto.randomUUID()
}
