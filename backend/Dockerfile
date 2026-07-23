# Stage 1: Build dependencies
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
# Remove local .env so container uses environment variables from docker-compose
RUN rm -f .env

# Stage 2: Execute in production environment
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
EXPOSE 8000
CMD ["bun", "src/index.ts"]
