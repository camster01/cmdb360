# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install && cd server && npm install
COPY . .
RUN npm run build:all

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY server/package*.json ./server/
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
