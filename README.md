# Auth API Example

An Elysia + Bun authentication API with JWT access tokens, HttpOnly refresh-token cookies, refresh-token rotation, Drizzle ORM, and Turso/libSQL.

## Features

- User registration and login
- JWT access tokens with 15 minute expiry
- HttpOnly refresh-token cookie with 7 day expiry
- Refresh-token rotation
- Logout current session and logout all sessions
- Protected `GET /api/v1/auth/me` route
- Drizzle migrations for Turso/libSQL
- Demo seed users for examples
- Interactive OpenAPI documentation with Scalar

## Tech Stack

- [Bun](https://bun.sh/)
- [Elysia](https://elysiajs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Turso/libSQL](https://turso.tech/)
- [@elysiajs/openapi](https://elysiajs.com/plugins/openapi)

## Requirements

- Bun 1.3 or newer
- A Turso database
- A Turso auth token with permission to run migrations and write demo seed data

## Installation

Clone the repository:

```bash
git clone https://github.com/naay99999/auth-api-example.git
cd auth-api-example
```

Install dependencies:

```bash
bun install
```

## Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your own values:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `PORT`

`.env` is ignored by git. Do not commit real Turso tokens or JWT secrets.

## Database Setup

Generate a migration after changing `src/db/schema.ts`:

```bash
bun run db:generate
```

Apply migrations to the configured Turso database:

```bash
bun run db:migrate
```

Open Drizzle Studio:

```bash
bun run db:studio
```

## Seed Demo Users

Seed demo users for documentation and manual testing:

```bash
bun run db:seed
```

The seed is idempotent. It uses `email` as the conflict key, updates demo user names and password hashes, and keeps existing user IDs and `createdAt` values.

Demo credentials:

| Email | Password | Name |
|---|---|---|
| alex@example.com | Password123! | Alex Example |
| maya@example.com | Password123! | Maya Example |
| sam@example.com | Password123! | Sam Example |

## Run the Server

Start the API in watch mode:

```bash
bun run dev
```

If you use `PORT=5678`, the server runs at:

```text
http://localhost:5678
```

## API Documentation

```text
http://localhost:5678/api/v1/docs
```

Open the Scalar documentation after starting the server. It includes all request and response examples from the generated OpenAPI schema.

## Example Flow

Login with a seeded user and save the refresh-token cookie:

```bash
curl -i -c cookies.txt -X POST http://localhost:5678/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex@example.com",
    "password": "Password123!"
  }'
```

Copy the `accessToken` from the response, then call a protected route:

```bash
curl -i http://localhost:5678/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

Refresh the access token using the saved refresh cookie:

```bash
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:5678/api/v1/auth/refresh
```

Logout:

```bash
curl -i -b cookies.txt -X POST http://localhost:5678/api/v1/auth/logout \
  -H "Authorization: Bearer <accessToken>"
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the API with hot reload |
| `bun run db:generate` | Generate Drizzle migration files |
| `bun run db:migrate` | Apply migrations to Turso |
| `bun run db:seed` | Seed demo users |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run test` | Not configured yet |

## Project Structure

```text
src/
  db/
    client.ts       Turso/libSQL Drizzle client
    schema.ts       Drizzle table schema
    seed.ts         Demo user seed script
    migrations/     Generated SQL migrations
  lib/
    config.ts       JWT configuration
    hash.ts         Password and token hashing helpers
  modules/
    auth/
      index.ts      Elysia auth routes and auth macro
      model.ts      TypeBox request and response schemas
      service.ts    Auth business logic
  index.ts          Root Elysia app, CORS, JWT, OpenAPI docs
```

## Notes

- Passwords are hashed with bcrypt.
- Refresh tokens are hashed before being stored.
- Raw refresh tokens are only sent as HttpOnly cookies.
- Access tokens are returned in the response body and should be sent as `Authorization: Bearer <accessToken>` for protected routes.
- OpenAPI docs are generated from Elysia route metadata and TypeBox schemas.
