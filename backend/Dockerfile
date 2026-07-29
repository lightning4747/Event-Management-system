# Stage 1: Build dependencies and compile
FROM oven/bun:1.3-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
# Remove local .env so the container only uses injected environment variables
RUN rm -f .env

# Stage 2: Production runtime
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app
COPY --from=builder /app ./

# Create uploads directory and ensure write permissions for appuser
RUN mkdir -p /app/uploads && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app && \
    chmod -R 777 /app/uploads

USER appuser

ENV NODE_ENV=production
EXPOSE 8000
CMD ["bun", "src/index.ts"]
