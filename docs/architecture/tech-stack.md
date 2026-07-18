# Technology & Dependency Stack

This document details the approved libraries, tooling, and dependencies for the development and deployment of the MCET AI&DS OD Approval Web Application. It outlines the reasons for adopting Bun as the JavaScript runtime, Docker container configs, and automated pipeline rules.

---

## 1. Backend Dependency Stack

The backend runs on **Bun** using **Express.js** and **TypeScript**.

### Core & Runtime
* **Runtime:** `bun` (version 1.1+ recommended)
* **API Framework:** `express`
* **Language Compilers:** `typescript` (target version 5.x)
* **Operating Containers:** `docker`

### Relational Database Layer
* **ORM Library:** `drizzle-orm` (provides fast, type-safe SQL query generation)
* **DB Client:** `pg` (PostgreSQL client)
* **Migrations Manager:** `drizzle-kit` (handles schema declarations and push-state updates)
* **Type Declarations:** `@types/pg`, `@types/express`, `@types/node`

### Authentication & API Security
* **Session Signature:** `jsonwebtoken` (handles secure stateless sessions)
* **Password Hashing:** `bcryptjs` (secure salting and hashing)
* **Security Headers:** `helmet` (protects Express apps by setting various HTTP headers)
* **Cross-Origin Sharing:** `cors` (manages frontend origin access permissions)
* **Types:** `@types/jsonwebtoken`, `@types/bcryptjs`, `@types/cors`

### Integrations, Formatting & Validation
* **Data Validator:** `zod` (runtime schema declaration and type-checking)
* **Date Calculator:** `date-fns` (essential for deadline date additions and verification logic)
* **OneDrive Client:** `@microsoft/microsoft-graph-client` (manages file API metadata queries)
* **Fetch Client:** `isomorphic-fetch`, `@types/isomorphic-fetch`

### Structured Logging & Diagnostics
* **Logger:** `pino` (extremely fast, low-overhead JSON logging)
* **HTTP Interceptor:** `pino-http` (records incoming requests automatically)
* **Console Pretty-print:** `pino-pretty` (dev environment logging decorator)

### Security Checking & Linting
* **Static Analysis:** `eslint`
* **Static Security Plugin:** `eslint-plugin-security` (flags raw SQL, unsafe regex patterns, and potential shell vulnerabilities)
* **Container Vulnerability Scan:** `trivy` (scans Docker layers for CVE exploits)

---

## 2. Frontend Dependency Stack

The frontend is a client-side web application built with **React**, **TypeScript**, and **Tailwind CSS**.

### Core Frame & State Management
* **Web Bundler:** `vite` (version 5.x+)
* **UI Libraries:** `react`, `react-dom`
* **Client Data Cache:** `@tanstack/react-query` (handles API data caching, polling, and invalidation)
* **Vite Plugin:** `@vitejs/plugin-react`
* **Types:** `@types/react`, `@types/react-dom`

### Schema-Driven Forms
* **Form Manager:** `react-hook-form` (manages input states without re-render lag)
* **Schema Validator:** `zod` (validates client inputs before sending to server API)
* **Resolver Hook:** `@hookform/resolvers` (bridges React Hook Form with Zod schemas)

### Design & Interface Tokens (Shadcn UI Base)
* **CSS Framework:** `tailwindcss`
* **Autoprefixer:** `autoprefixer`
* **CSS Preprocessor:** `postcss`
* **Tailwind Class Utilities:** `class-variance-authority`, `clsx`, `tailwind-merge`
* **Layout Animations:** `tailwindcss-animate`
* **Vector Icons:** `lucide-react`
* **Radix UI Primitives:**
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-label`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-select`
  - `@radix-ui/react-slot`

---

## 3. Runtime & Containerization Rationale

### 3.1 Bun Runtime
Rather than standard Node.js, **Bun** is utilized as the primary runner for backend operations for several reasons:
* **Speed:** Bun offers faster execution times and quick package installation (`bun install`).
* **Direct TypeScript Execution:** Bun executes `.ts` files natively without requiring pre-compilation steps during development, streamlining local setups.
* **Low Footprint:** Fits well within resource-limited container hosting tiers.

### 3.2 Docker Container Configuration
The backend server runs inside a Docker container. Below is the blueprint of the optimized Multi-Stage Dockerfile using a lightweight Alpine base:

```dockerfile
# Stage 1: Build dependencies
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .

# Stage 2: Execute in production environment
FROM oven/bun:1.1-alpine AS runner
WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "src/index.ts"]
```

---

## 4. CI/CD Pipeline Automation Blueprint

On push triggers (e.g. GitHub Actions), the following operations verify stability before a build is sent to production servers:

```
       [ Developer Push ]
               │
               ▼
┌──────────────────────────────┐
│       1. Bun Setup           │ ──> Fast cache restoration
└──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│    2. Dependency Audit       │ ──> bunx audit (Vulnerability check)
└──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  3. Code Quality & Security  │ ──> bun run lint (Runs ESLint + Security checks)
└──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│    4. Compile Verification   │ ──> bun run build (Fails if types mismatch)
└──────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│  5. Container Security Scan  │ ──> Trivy Docker Image Scan
└──────────────────────────────┘
               │
               ▼
       [ Safe Deployment ]
```

### Steps Explanation
1. **Bun Setup:** Boots up the pipeline and downloads cached packages instantly via `bun install --frozen-lockfile`.
2. **Dependency Audit:** Runs `bunx audit` to scan for known vulnerabilities in external modules.
3. **Security Linting:** Verifies that raw SQL queries, unsafe regexes, and vulnerable variables are caught using `eslint-plugin-security`.
4. **Compilation Check:** Validates TypeScript configurations. If any frontend component breaks backend schemas, the build fails immediately.
5. **Container Verification:** Analyzes the final Docker container configuration using `Trivy` to flag security vulnerabilities before pushing to the cloud registry.
