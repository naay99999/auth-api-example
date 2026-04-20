# PRD: Student Auth API

**Stack:** Elysia (Bun) · Turso (libSQL) · Drizzle ORM  
**Client:** React (Web)  
**Level:** B — Standard  
**Version:** 1.1  
**Date:** 2026-04-20

---

## 1. Overview

REST API สำหรับระบบ Authentication ของนักเรียน ออกแบบให้ใช้งานร่วมกับ React frontend โดยใช้ JWT Access Token + Refresh Token rotation เพื่อความปลอดภัยและ UX ที่ดี

---

## 2. Goals

- ให้นักเรียน register / login / logout ได้
- จัดการ session ผ่าน Access Token อายุสั้น + Refresh Token อายุยาว
- รองรับ logout จากทุก device (revoke all sessions)
- Deploy ฟรีได้จริง บน Railway

---

## 3. Non-Goals

- ไม่มี Role-Based Access Control (RBAC)
- ไม่มี OAuth / Social Login
- ไม่มี Email Verification
- ไม่มี Admin Dashboard

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Elysia |
| Database | Turso (libSQL / SQLite) |
| ORM | Drizzle ORM |
| Auth | `@elysiajs/jwt` (HS256) + bcrypt |
| Validation | Elysia TypeBox (built-in) + `drizzle-typebox` |
| CORS | `@elysiajs/cors` |
| Bearer Token | `@elysiajs/bearer` |
| Rate Limiting | `elysia-rate-limit` |
| Deploy | Railway |

---

## 5. Database Schema

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (ULID) | Primary Key |
| `email` | TEXT | Unique, Not Null |
| `password_hash` | TEXT | bcrypt, Not Null |
| `name` | TEXT | Not Null |
| `created_at` | INTEGER | Unix timestamp |
| `updated_at` | INTEGER | Unix timestamp |

### `refresh_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (ULID) | Primary Key |
| `user_id` | TEXT | FK → users.id (CASCADE DELETE) |
| `token_hash` | TEXT | SHA-256 hash of token |
| `expires_at` | INTEGER | Unix timestamp |
| `revoked_at` | INTEGER | NULL = active |
| `created_at` | INTEGER | Unix timestamp |

> เก็บเฉพาะ hash ของ refresh token ใน DB ไม่เก็บ token ดิบ

---

## 6. API Endpoints

### Base URL

```
https://<your-domain>/api/v1
```

### 6.1 Register

```
POST /auth/register
```

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "min8chars",
  "name": "สมชาย ใจดี"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "01HXYZ...",
    "email": "student@example.com",
    "name": "สมชาย ใจดี"
  },
  "accessToken": "<jwt>",
  "expiresIn": 900
}
```

**Set-Cookie:** `refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800`

**Errors:**
- `409` — Email already exists
- `422` — Validation failed

---

### 6.2 Login

```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "student@example.com",
  "password": "min8chars"
}
```

**Response 200:**
```json
{
  "user": {
    "id": "01HXYZ...",
    "email": "student@example.com",
    "name": "สมชาย ใจดี"
  },
  "accessToken": "<jwt>",
  "expiresIn": 900
}
```

**Set-Cookie:** `refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800`

**Errors:**
- `401` — Invalid credentials
- `429` — Rate limit exceeded (5 attempts / 15 min per IP)

---

### 6.3 Refresh Token

```
POST /auth/refresh
```

Cookies ต้องมี `refresh_token`

**Response 200:**
```json
{
  "accessToken": "<new_jwt>",
  "expiresIn": 900
}
```

**Set-Cookie:** refresh token ใหม่ (rotation — token เก่าถูก revoke ทันที)

**Errors:**
- `401` — Token invalid / expired / revoked

---

### 6.4 Logout

```
POST /auth/logout
```

**Headers:** `Authorization: Bearer <accessToken>`

Cookies ต้องมี `refresh_token`

**Response 200:**
```json
{
  "message": "Logged out successfully"
}
```

ล้าง cookie + revoke refresh token นั้น

---

### 6.5 Logout All Devices

```
POST /auth/logout-all
```

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{
  "message": "All sessions revoked"
}
```

Revoke ทุก refresh token ของ user คนนั้น

---

### 6.6 Get Current User

```
GET /auth/me
```

**Headers:** `Authorization: Bearer <accessToken>`

**Response 200:**
```json
{
  "id": "01HXYZ...",
  "email": "student@example.com",
  "name": "สมชาย ใจดี",
  "createdAt": "2026-04-20T10:00:00Z"
}
```

**Errors:**
- `401` — Token invalid / expired

---

## 7. Token Strategy

| Token | TTL | เก็บที่ไหน (Client) |
|---|---|---|
| Access Token (JWT) | 15 นาที | Memory (React state / context) |
| Refresh Token | 7 วัน | HttpOnly Cookie |

**ทำไมถึงไม่เก็บ Access Token ใน localStorage:**  
XSS attack สามารถขโมย localStorage ได้ แต่ไม่สามารถอ่าน HttpOnly cookie ได้

**Refresh Token Rotation:**  
ทุกครั้งที่ใช้ refresh token → token เก่าถูก revoke ทันที → ออก token ใหม่ให้ แก้ปัญหา token reuse

---

## 8. Security Requirements

| Item | Spec |
|---|---|
| Password hashing | bcrypt, cost factor 12 |
| JWT secret | HS256, min 32 chars, จาก env |
| Rate limiting | Login: 5 req / 15 min / IP (`elysia-rate-limit`) |
| CORS | `@elysiajs/cors` — whitelist `CLIENT_ORIGIN` env เท่านั้น |
| Cookie flags | HttpOnly, Secure, SameSite=Strict |
| Refresh token storage | เก็บ SHA-256 hash ใน DB เท่านั้น |

---

## 9. Project Structure

```
src/
├── index.ts                  # Entry point — Elysia app, mount plugins + modules
├── db/
│   ├── client.ts             # Turso libSQL connection (singleton)
│   ├── schema.ts             # Drizzle schema (users, refresh_tokens)
│   └── migrations/           # SQL migration files
├── modules/
│   └── auth/
│       ├── index.ts          # Auth controller — Elysia instance, defines routes
│       ├── service.ts        # Business logic — abstract class, static methods
│       └── model.ts          # TypeBox schemas (DTOs) + exported types
└── lib/
    └── hash.ts               # bcrypt helpers + SHA-256 (crypto.subtle)
```

### ไฟล์หลักแต่ละไฟล์

**`src/index.ts`** — Mount ทุกอย่างเข้าด้วยกัน:
```typescript
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'
import { rateLimit } from 'elysia-rate-limit'
import { authModule } from './modules/auth'

const app = new Elysia()
  .use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET!, exp: '15m' }))
  .use(rateLimit())
  .get('/health', () => 'OK')
  .use(authModule)
  .listen(process.env.PORT ?? 3000)
```

**`src/modules/auth/model.ts`** — TypeBox schemas + types:
```typescript
import { t } from 'elysia'

export const AuthModel = {
  register: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 8 }),
    name: t.String({ minLength: 1 })
  }),
  login: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String()
  })
}

export type RegisterDTO = typeof AuthModel.register.static
export type LoginDTO = typeof AuthModel.login.static
```

**`src/modules/auth/service.ts`** — abstract class, ไม่ผูกกับ Elysia Context:
```typescript
import { status } from 'elysia'

abstract class AuthService {
  static async register(dto: RegisterDTO) { ... }
  static async login(dto: LoginDTO) { ... }
  // return status(401, '...') instead of throw
}
```

**`src/modules/auth/index.ts`** — Elysia instance เป็น controller:
```typescript
import { Elysia } from 'elysia'
import { bearer } from '@elysiajs/bearer'
import { jwt } from '@elysiajs/jwt'
import { AuthModel } from './model'
import { AuthService } from './service'

// isAuth macro ใช้ verify JWT จาก Bearer token
const authPlugin = new Elysia({ name: 'Auth.Plugin' })
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))
  .use(bearer())
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

export const authModule = new Elysia({ prefix: '/api/v1/auth' })
  .use(authPlugin)
  .model({ 'auth.register': AuthModel.register, 'auth.login': AuthModel.login })
  .post('/register', ({ body }) => AuthService.register(body), {
    body: 'auth.register'
  })
  .post('/login', ({ body }) => AuthService.login(body), {
    body: 'auth.login'
  })
  .post('/refresh', ({ cookie: { refresh_token } }) =>
    AuthService.refresh(refresh_token.value)
  )
  .post('/logout', ({ cookie: { refresh_token }, userId }) =>
    AuthService.logout(refresh_token, userId), { isAuth: true }
  )
  .post('/logout-all', ({ userId }) => AuthService.logoutAll(userId), {
    isAuth: true
  })
  .get('/me', ({ userId }) => AuthService.getMe(userId), { isAuth: true })
```

> **Elysia Macro ใช้แทน Middleware:** `isAuth: true` บน route ใดก็ได้ เพื่อ guard JWT และ inject `userId` เข้า context โดยอัตโนมัติ — ไม่ต้องเขียน middleware แยก

### Cookie pattern (Elysia reactive cookie API)

```typescript
// Set refresh token cookie
cookie.refresh_token.set({
  value: rawToken,
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth/refresh',
  maxAge: 604800
})

// Clear cookie on logout
cookie.refresh_token.remove()
```

---

## 10. Environment Variables

```env
# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# JWT
JWT_SECRET=your-super-secret-min-32-chars

# App
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=production
```

> หมายเหตุ: `JWT_ACCESS_EXPIRES` และ `JWT_REFRESH_EXPIRES` ถูกลบออก เพราะ `@elysiajs/jwt` รับ `exp` เป็น string (`'15m'`, `'7d'`) โดยตรงใน plugin config

---

## 11. Dependencies

```bash
# Core
bun add elysia @elysiajs/jwt @elysiajs/cors @elysiajs/bearer

# Rate limiting
bun add elysia-rate-limit

# Database & ORM
bun add @libsql/client drizzle-orm drizzle-typebox

# Auth utils
bun add bcryptjs ulidx

# Dev
bun add -d drizzle-kit @types/bcryptjs
```

> **ไม่ต้องติดตั้ง `jose`** — `@elysiajs/jwt` จัดการ JWT ให้ครบถ้วนแล้ว

---

## 12. React Integration Guide

### Token Management

```
React App
├── authContext.tsx     — เก็บ accessToken ใน memory (useState)
├── api.ts             — axios/fetch instance ที่แนบ Authorization header
└── useAuth.ts         — hook: login, logout, refresh
```

### Silent Refresh Flow

```
1. accessToken หมดอายุ → API return 401
2. axios interceptor จับ 401
3. เรียก POST /api/v1/auth/refresh (cookie ส่งอัตโนมัติ)
4. ได้ accessToken ใหม่ → retry request เดิม
5. ถ้า refresh ก็ 401 → redirect to login
```

---

## 13. Deployment (Railway)

```bash
# 1. สร้าง project ใน Railway
# 2. Connect GitHub repo
# 3. Add environment variables ทั้งหมด
# 4. Railway detect Bun อัตโนมัติ (bun.lockb)
```

**Start command:**
```bash
bun run src/index.ts
```

**Health check endpoint:**
```
GET /health → 200 OK
```

---

## 14. Success Criteria

- [ ] Register / Login / Logout ทำงานได้ถูกต้อง
- [ ] Refresh token rotation ทำงาน — token เก่า revoke ทันที
- [ ] Logout-all revoke ทุก session ได้
- [ ] Rate limiting บน login endpoint
- [ ] CORS ล็อค origin เรียบร้อย
- [ ] Deploy บน Railway ผ่าน — ไม่ sleep
- [ ] React ทำ silent refresh ได้โดยไม่ต้อง login ซ้ำ

---

## 15. Out of Scope (Future)

- Email verification
- Password reset via email
- Google / LINE OAuth
- Role management
- Device tracking / session list UI
