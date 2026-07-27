# MCET AI&DS On-Duty Approval Portal

An internal role-based web application to digitize the On-Duty (OD) approval workflow for the MCET Department of Artificial Intelligence & Data Science.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Bun, Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Server | Nginx (reverse proxy + static serving) |
| Runtime | Docker & Docker Compose |

---

## Quick Start (Docker — Recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2

### 1. Configure Secrets
```bash
cp .env.example .env
```
Open `.env` and set your values — especially `POSTGRES_PASSWORD` and `JWT_SECRET`.

> **Generate a strong JWT secret:**
> ```bash
> openssl rand -hex 64
> ```

### 2. Start in Development Mode
```bash
docker compose up --build
```

- **Frontend** → http://localhost (with Nginx, mirrors production)
- **Backend API** → http://localhost:8000 (exposed for Postman / API testing)
- **Hot reload** is active — edits to `backend/src/` restart the server automatically

### 3. Start in Production Mode
```bash
docker compose -f docker-compose.yml up -d --build
```

- **Frontend** → http://localhost (only exposed service)
- Backend is private — accessible only through the frontend's `/api/` proxy
- Run `docker compose logs -f` to tail logs

### Useful Commands

```bash
# View running containers
docker compose ps

# View logs
docker compose logs -f

# Stop everything
docker compose down

# Stop and wipe all data (database + uploads)
docker compose down -v

# Rebuild after dependency changes
docker compose up --build
```

---

## Local Development (Without Docker)

For faster iteration without Docker, run the backend and frontend directly.

### Prerequisites
- [Bun](https://bun.sh) ≥ 1.1
- PostgreSQL 16 running locally

### Backend
```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL
bun install
bun dev                # starts on http://localhost:8000 with hot reload
```

### Frontend
```bash
cd frontend
bun install
bun dev                # starts on http://localhost:5173 with Vite proxy
```

The Vite dev server proxies `/api/` requests to `http://localhost:8000` automatically.

---

## Project Structure

```
Event-Management-system/
├── .env.example              # ← Copy to .env, fill in secrets
├── docker-compose.yml        # Production compose (base)
├── docker-compose.override.yml  # Dev overrides (auto-merged)
├── backend/
│   ├── .env.example          # ← For local (non-Docker) dev
│   ├── Dockerfile
│   ├── src/
│   │   ├── db/               # Drizzle ORM schema & migrations
│   │   ├── modules/          # Feature modules (auth, applications, etc.)
│   │   ├── middleware/
│   │   └── index.ts          # Entry point
│   └── drizzle/              # SQL migration files
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf            # Nginx config (proxy + static)
│   └── src/
│       ├── components/
│       ├── pages/
│       └── lib/
└── .github/workflows/ci.yml  # GitHub Actions CI
```

---

## Environment Variables Reference

All secrets are managed via the root `.env` file (see `.env.example`).

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `JWT_SECRET` | Yes | Secret for signing JWTs — use a long random string in prod |
| `STORAGE_PROVIDER` | No | `local` (default) or `onedrive` |
| `ONEDRIVE_TENANT_ID` | If OneDrive | Azure AD tenant ID |
| `ONEDRIVE_CLIENT_ID` | If OneDrive | Azure app client ID |
| `ONEDRIVE_CLIENT_SECRET` | If OneDrive | Azure app client secret |
| `ONEDRIVE_USER_ID` | If OneDrive | OneDrive account email |

---

## Documentation

Full project documentation, specifications, workflows, and database schema:

- [Central Documentation Landing Page](docs/README.md)
