# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev                    # Start dev server with hot reload on http://localhost:5678
bun run src/index.ts           # Run without watch mode

# Database (drizzle-kit)
bunx drizzle-kit generate      # Generate migration from schema changes
bunx drizzle-kit migrate       # Apply migrations to Turso
bunx drizzle-kit studio        # Open Drizzle Studio
```

No test suite is configured yet (`test` script exits with error).

## Environment variables

Required at startup — app throws immediately if missing:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs/verifies JWTs |
| `TURSO_DATABASE_URL` | libSQL database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `CLIENT_ORIGIN` | Allowed CORS origin |
| `PORT` | Optional, defaults to 5678 |

## Architecture

Elysia API on Bun with a Turso (libSQL) database accessed via Drizzle ORM.

### Module layout

- `src/index.ts` — root app: CORS, JWT plugin, `/health`, mounts `authModule`
- `src/modules/auth/index.ts` — all auth routes under `/api/v1/auth`
- `src/modules/auth/service.ts` — business logic (`AuthService`)
- `src/modules/auth/model.ts` — TypeBox request schemas + DTO types
- `src/db/schema.ts` — Drizzle table definitions (`users`, `refresh_tokens`)
- `src/db/client.ts` — singleton `db` export
- `src/lib/config.ts` — `JWT_CONFIG` constant
- `src/lib/hash.ts` — bcrypt password helpers + SHA-256 token hashing

### Auth flow

Access tokens are short-lived JWTs (15 min, `sub` = userId). Refresh tokens are random ULIDs stored **hashed** (SHA-256) in the DB with a 7-day TTL. Rotation is atomic (transaction revokes old, inserts new). Refresh token is delivered as an `httpOnly; secure; sameSite=strict` cookie scoped to `/api/v1/auth`.

### Route protection pattern

`authPlugin` defines an Elysia macro `isAuth` that verifies the bearer token and injects `userId` into the handler context. Protected routes pass `{ isAuth: true }` as route options.

### Elysia conventions

- Route handlers return `status(code, body)` for errors — Elysia infers response types from this.
- Models registered with `.model()` are referenced by string key in `body:` options.
- Plugins use `{ name: '...' }` to prevent duplicate registration when `.use()`d multiple times.
- IDs use ULID (`ulidx`); timestamps are Unix epoch integers.
