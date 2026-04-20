import { status } from 'elysia'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { ulid } from 'ulidx'
import { db } from '../../db/client'
import { users, refreshTokens } from '../../db/schema'
import { hashPassword, verifyPassword, hashToken } from '../../lib/hash'
import type { RegisterDTO, LoginDTO } from './model'

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/api/v1/auth/refresh',
    maxAge: REFRESH_TTL_SECONDS,
  }
}

async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = ulid()
  const tokenHash = await hashToken(rawToken)
  const now = Math.floor(Date.now() / 1000)

  await db.insert(refreshTokens).values({
    id: ulid(),
    userId,
    tokenHash,
    expiresAt: now + REFRESH_TTL_SECONDS,
    createdAt: now,
  })

  return rawToken
}

export const AuthService = {
  async register(dto: RegisterDTO) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .get()

    if (existing) return status(409, 'Email already exists')

    const id = ulid()
    const passwordHash = await hashPassword(dto.password)
    const now = Math.floor(Date.now() / 1000)

    await db.insert(users).values({
      id,
      email: dto.email,
      passwordHash,
      name: dto.name,
      createdAt: now,
      updatedAt: now,
    })

    return {
      userId: id,
      email: dto.email,
      name: dto.name,
    }
  },

  async login(dto: LoginDTO) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .get()

    if (!user) return status(401, 'Invalid credentials')

    const valid = await verifyPassword(dto.password, user.passwordHash)
    if (!valid) return status(401, 'Invalid credentials')

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
    }
  },

  async refresh(rawToken: string | undefined) {
    if (!rawToken) return status(401, 'Token invalid or expired')

    const tokenHash = await hashToken(rawToken)
    const now = Math.floor(Date.now() / 1000)

    const existing = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, now),
        ),
      )
      .get()

    if (!existing) return status(401, 'Token invalid or expired')

    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(eq(refreshTokens.id, existing.id))

    const newRawToken = await issueRefreshToken(existing.userId)

    return { userId: existing.userId, newRawToken }
  },

  async logout(rawToken: string | undefined) {
    if (!rawToken) return

    const tokenHash = await hashToken(rawToken)
    const now = Math.floor(Date.now() / 1000)

    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
        ),
      )
  },

  async logoutAll(userId: string) {
    const now = Math.floor(Date.now() / 1000)

    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
        ),
      )
  },

  async getMe(userId: string) {
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get()

    if (!user) return status(401, 'Unauthorized')

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: new Date(user.createdAt * 1000).toISOString(),
    }
  },

  cookieOptions,
  issueRefreshToken,
}
