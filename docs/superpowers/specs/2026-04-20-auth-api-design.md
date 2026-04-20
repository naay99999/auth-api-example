# Auth API Design

**Date:** 2026-04-20  
**Stack:** Elysia (Bun) · Turso (libSQL) · Drizzle ORM  
**PRD:** prd.md v1.1

---

## Overview

REST API for student authentication using JWT Access Token (15m) + Refresh Token rotation (7d). Refresh tokens are stored as SHA-256 hashes in Turso (libSQL). Access tokens are never stored. Deployed on Railway.

---

## Project Structure

```
src/
├── index.ts                        # App entry: mount plugins, register authModule, listen
├── db/
│   ├── client.ts                   # Turso libSQL singleton connection
│   ├── schema.ts                   # Drizzle schema: users + refresh_tokens tables
│   └── migrations/                 # SQL migration files (drizzle-kit generate)
├── modules/
│   └── auth/
│       ├── index.ts                # Elysia controller: route definitions + isAuth macro
│       ├── service.ts              # Plain object: AuthService with all business logic methods
│       └── model.ts                # TypeBox schemas (AuthModel) + exported DTO types
└── lib/
    ├── config.ts                   # JWT_CONFIG constant shared by app + auth plugin
    └── hash.ts                     # bcrypt helpers + SHA-256 via crypto.subtle
```

**Responsibility boundaries:**
- `service.ts` — zero Elysia imports; pure business logic; takes plain values, returns plain values or `status()` responses
- `modules/auth/index.ts` — owns all Elysia context wiring: cookies, bearer, JWT verify, calling service methods
- `lib/config.ts` — exports `JWT_CONFIG = { name: 'jwt', secret: process.env.JWT_SECRET!, exp: '15m' }` used by both `src/index.ts` and `src/modules/auth/index.ts`

Also at project root: `drizzle.config.ts` pointing to `src/db/schema.ts`, outputting to `src/db/migrations/`, using libSQL driver.

---

## Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (ULID) | Primary Key |
| `email` | TEXT | Unique, Not Null |
| `password_hash` | TEXT | bcrypt cost 12, Not Null |
| `name` | TEXT | Not Null |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |

### `refresh_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (ULID) | Primary Key |
| `user_id` | TEXT | FK → users.id (CASCADE DELETE) |
| `token_hash` | TEXT | SHA-256 hash of raw token — raw token never stored |
| `expires_at` | INTEGER | Unix timestamp |
| `revoked_at` | INTEGER | NULL = active |
| `created_at` | INTEGER | Unix timestamp |

---

## Token Flow

**Register / Login:**
1. Validate input via TypeBox
2. For register: check email uniqueness (409 if taken), hash password with bcrypt cost 12, insert user
3. For login: look up user by email, verify password (401 if mismatch)
4. Generate raw refresh token (ulidx `ulid()`), SHA-256 hash it, insert row in `refresh_tokens` with `expires_at = now + 7d`
5. Sign JWT: `{ sub: userId }`, exp 15m
6. Set HttpOnly cookie with raw token, return `{ user, accessToken, expiresIn: 900 }`

**Refresh:**
1. Read raw token from cookie
2. SHA-256 hash it, query `refresh_tokens` where `token_hash = ? AND revoked_at IS NULL AND expires_at > now`
3. If not found → `status(401, 'Token invalid or expired')`
4. Set `revoked_at = now` on old row (rotation)
5. Insert new refresh token row, set new cookie
6. Return `{ accessToken, expiresIn: 900 }`

**Logout:**
1. Verify JWT via `isAuth` macro → inject `userId`
2. SHA-256 hash cookie token, set `revoked_at = now` on matching row
3. Clear cookie, return `{ message: 'Logged out successfully' }`

**Logout-all:**
1. Verify JWT via `isAuth` → inject `userId`
2. `UPDATE refresh_tokens SET revoked_at = now WHERE user_id = ? AND revoked_at IS NULL`
3. Return `{ message: 'All sessions revoked' }`

---

## API Endpoints

**Base prefix:** `/api/v1/auth`

| Method | Path | Guard | Success |
|---|---|---|---|
| `POST` | `/register` | none | 201: `{ user, accessToken, expiresIn }` + cookie |
| `POST` | `/login` | rate limit | 200: `{ user, accessToken, expiresIn }` + cookie |
| `POST` | `/refresh` | none | 200: `{ accessToken, expiresIn }` + new cookie |
| `POST` | `/logout` | `isAuth` | 200: `{ message }` |
| `POST` | `/logout-all` | `isAuth` | 200: `{ message }` |
| `GET` | `/me` | `isAuth` | 200: `{ id, email, name, createdAt }` |
| `GET` | `/health` | none | 200: `"OK"` (on root app, not prefix) |

**Error codes:**
- `401` — invalid credentials, bad/expired/revoked token
- `409` — email already exists
- `422` — TypeBox validation failure (automatic)
- `429` — rate limit exceeded (elysia-rate-limit automatic, login only: 5 req/15min/IP)

**Cookie flags** (all refresh token set/clear operations):
```
httpOnly: true, secure: true, sameSite: 'strict',
path: '/api/v1/auth/refresh', maxAge: 604800
```

---

## isAuth Macro

Defined in `src/modules/auth/index.ts` on an `authPlugin` Elysia instance:

```typescript
.macro({
  isAuth: {
    async resolve({ bearer, jwt, status }) {
      if (!bearer) return status(401, 'Unauthorized')
      const payload = await jwt.verify(bearer)
      if (!payload) return status(401, 'Unauthorized')
      return { userId: payload.sub as string }
    }
  }
})
```

Routes with `{ isAuth: true }` receive `userId` injected into context automatically.

---

## Dependencies

```bash
# Core
bun add @elysiajs/jwt @elysiajs/cors @elysiajs/bearer elysia-rate-limit

# Database
bun add @libsql/client drizzle-orm drizzle-typebox

# Auth utils
bun add bcryptjs ulidx

# Dev
bun add -d drizzle-kit @types/bcryptjs
```

---

## Environment Variables

```env
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
JWT_SECRET=your-super-secret-min-32-chars
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=production
```

---

## Security Requirements

| Item | Spec |
|---|---|
| Password hashing | bcrypt, cost factor 12 |
| JWT secret | HS256, min 32 chars, from env |
| Rate limiting | Login: 5 req / 15 min / IP |
| CORS | Whitelist `CLIENT_ORIGIN` env only |
| Cookie flags | HttpOnly, Secure, SameSite=Strict |
| Refresh token storage | SHA-256 hash only — raw token never persisted |

---

## Out of Scope

- RBAC, OAuth, Email verification, Admin dashboard
- Test suite (none configured)
- Password reset, device tracking, session list UI
