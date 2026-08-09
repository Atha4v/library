# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY backend/package.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/server.ts ./
COPY backend/src ./src

RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY backend/package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY database ./database

RUN mkdir -p data && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
