# Stage 1: Build static assets
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install
COPY . .
RUN bun run build

# Stage 2: Serve using Nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
