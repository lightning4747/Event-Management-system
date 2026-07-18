# MCET AI&DS OD Approval App — Coding Standards

## 1. General

- TypeScript everywhere (frontend and backend). No `.js`/`.jsx` files.
- `strict: true` in `tsconfig.json`. No `any` — use `unknown` + narrowing, or proper types.
- No implicit `any`, no non-null `!` assertions unless justified with a comment.
- Prettier for formatting, ESLint for linting. Both run on pre-commit (Husky + lint-staged).
- 2-space indent, semicolons on, single quotes, trailing commas (`es5`).

## 2. Project Structure

```
/frontend
  /src
    /components   # reusable, presentational
    /features      # feature-scoped (e.g. od-application/, certificates/)
    /pages
    /hooks
    /lib           # api client, utils
    /types
/backend
  /src
    /modules       # auth/, applications/, approvals/, certificates/, reports/
      <module>/
        <module>.controller.ts
        <module>.service.ts
        <module>.routes.ts
        <module>.types.ts
    /middleware
    /db            # drizzle schema, migrations
    /lib
```

- Each backend module owns its own controller/service/routes — no cross-module DB calls; go through the other module's service.
- Barrel files (`index.ts`) only at module/feature root, not in every folder.

## 3. Naming

| Item | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `ApplicationCard.tsx` |
| Files (everything else) | kebab-case | `approval-service.ts` |
| Variables/functions | camelCase | `getPendingApplications` |
| Types/interfaces | PascalCase | `ODApplication` |
| Enums | PascalCase name, UPPER_CASE members | `ApplicationStatus.APPROVED` |
| DB tables/columns | snake_case | `od_applications`, `created_at` |
| React components | PascalCase | `CertificateUploadForm` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_CERT_WINDOW_DAYS` |

No abbreviations beyond well-known ones (`id`, `url`, `od`). No Hungarian notation.

## 4. React / Frontend

- Function components + hooks only. No class components.
- One component per file, file name matches component name.
- Props typed with an explicit `interface Props`, not inline types, for anything beyond 1–2 fields.
- Keep components under ~200 lines; extract subcomponents or hooks past that.
- Server state (API data) via React Query — never store fetched data in raw `useState` + `useEffect`.
- Local/UI state via `useState`/`useReducer`. Global state only for auth/session — no app-wide store beyond that.
- No business logic in components: validation, status-derivation, formatting go in `/lib` or hooks.
- Tailwind only, no inline `style={}` except for computed/dynamic values.

## 5. Backend / API

- Layering is fixed: `routes → controller → service → db`. Controllers never touch Drizzle directly.
- Controllers: parse/validate input (Zod), call service, shape HTTP response. No business logic.
- Services: all business logic, transaction boundaries, workflow rules (approval chain, immutability of rejected applications, one-time deadline extension, etc.).
- Every route input validated with a Zod schema before hitting the controller body.
- REST conventions: plural nouns, nested resources for ownership (`/applications/:id/certificates`), standard verbs/status codes (200/201/400/401/403/404/409/500).
- Auth/role checks happen in middleware (`requireRole('MENTOR')`), never re-implemented per route.
- No raw SQL string concatenation — Drizzle query builder or parameterized queries only.

## 6. Error Handling

- Centralized error middleware; services throw typed errors (`class AppError extends Error { statusCode, code }`), never raw `throw new Error(string)` for expected failures.
- Consistent error response shape: `{ error: { code, message } }`.
- Never swallow errors silently — log with context (userId, applicationId) on the server.
- Frontend: API errors surfaced via toast/inline message, not `alert()`.

## 7. Database (Drizzle + PostgreSQL)

- Schema lives in `/backend/src/db/schema.ts` (or split per module, re-exported).
- All writes to immutable-audit tables (`APPLICATION_APPROVAL_HISTORY`, extensions, certificate uploads) are insert-only — no UPDATE/DELETE on history rows.
- Every migration goes through `drizzle-kit generate` — no hand-edited migration files.
- Foreign keys enforced at DB level, not just application level.
- Timestamps (`created_at`, `updated_at`) on every table, set by DB default, not app code.

## 8. Auth & Security

- Passwords hashed with bcrypt (cost ≥ 12). Never log or return password hashes.
- JWT: short-lived access token + refresh token; role embedded in payload, but every protected route re-checks role server-side (never trust client role claims for authorization decisions).
- All input sanitized/validated before DB access (Zod on the way in stops most injection/XSS vectors).
- Secrets via environment variables only, never committed. `.env.example` kept up to date, `.env` gitignored.

## 9. Git Workflow

- Branches: `feature/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org) — `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
- No direct commits to `main`. PR required, at least self-review checklist before merge.
- Squash-merge to keep history linear.

## 10. Testing

- Backend: unit tests per service (approval-chain transitions, deadline-extension rule, certificate re-upload flow) with Vitest/Jest.
- Frontend: component tests for forms and status displays with React Testing Library.
- Critical workflow paths (full approval chain, rejection → immutability, one-time extension) must have integration test coverage before merge.

## 11. Documentation

- Every module has a short `README.md` describing its responsibility and public service methods.
- API documented (OpenAPI/Swagger or a maintained `API.md`) and kept in sync with routes.
- Non-obvious business rules (e.g. "extension allowed only once, only after deadline expiry") documented as comments at the point of enforcement in code, not just in this doc.