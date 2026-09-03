# Multi-stage Dockerfile for Smart Credit Ledger (Client + Server)
FROM node:20-alpine AS builder
WORKDIR /app
# Install dependencies for root (client)
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS server
WORKDIR /app
# Copy built frontend
COPY --from=builder /app/dist ./dist
# Server setup
COPY server/package.json ./server/package.json
WORKDIR /app/server
RUN npm install --omit=dev
COPY server/ ./

# Back to app root
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "server/index.js"]
