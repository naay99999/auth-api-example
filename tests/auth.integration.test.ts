import { describe, expect, test } from 'bun:test'
import { createApp } from '../src/app'

type AuthResponse = {
  user: {
    id: string
    email: string
    name: string
  }
  accessToken: string
  expiresIn: number
}

type RefreshResponse = {
  accessToken: string
  expiresIn: number
}

const app = createApp({
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  enableOpenApi: false,
  enableRateLimit: false,
})

function getSetCookies(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const setCookies = headers.getSetCookie?.()
  if (setCookies?.length) return setCookies

  const setCookie = response.headers.get('set-cookie')
  return setCookie ? [setCookie] : []
}

function getRefreshCookie(response: Response): string {
  const setCookie = getSetCookies(response).find((cookie) => cookie.startsWith('refresh_token='))

  expect(setCookie).toBeDefined()
  expect(setCookie).toContain('HttpOnly')

  return setCookie?.split(';')[0] ?? ''
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  )
}

function postRequest(path: string, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers,
    }),
  )
}

function getRequest(path: string, headers: Record<string, string> = {}) {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: 'GET',
      headers,
    }),
  )
}

describe('auth integration', () => {
  test('registers, authenticates, rotates refresh tokens, and logs out', async () => {
    const email = `it-${Date.now()}-${crypto.randomUUID()}@example.com`
    const password = 'Password123!'
    const name = 'Integration Test'

    const registerResponse = await jsonRequest('/api/v1/auth/register', { email, password, name })
    expect(registerResponse.status).toBe(201)

    const registered = (await registerResponse.json()) as AuthResponse
    expect(registered.user.email).toBe(email)
    expect(registered.user.name).toBe(name)
    expect(registered.accessToken.length).toBeGreaterThan(0)
    expect(registered.expiresIn).toBe(900)

    const initialRefreshCookie = getRefreshCookie(registerResponse)

    const duplicateResponse = await jsonRequest('/api/v1/auth/register', { email, password, name })
    expect(duplicateResponse.status).toBe(409)

    const missingBearerResponse = await getRequest('/api/v1/auth/me')
    expect(missingBearerResponse.status).toBe(401)

    const profileResponse = await getRequest('/api/v1/auth/me', {
      Authorization: `Bearer ${registered.accessToken}`,
    })
    expect(profileResponse.status).toBe(200)

    const profile = (await profileResponse.json()) as AuthResponse['user'] & { createdAt: string }
    expect(profile.id).toBe(registered.user.id)
    expect(profile.email).toBe(email)
    expect(profile.name).toBe(name)
    expect(profile.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const refreshResponse = await postRequest('/api/v1/auth/refresh', {
      Cookie: initialRefreshCookie,
    })
    expect(refreshResponse.status).toBe(200)

    const refreshed = (await refreshResponse.json()) as RefreshResponse
    expect(refreshed.accessToken.length).toBeGreaterThan(0)
    expect(refreshed.expiresIn).toBe(900)

    const rotatedRefreshCookie = getRefreshCookie(refreshResponse)
    expect(rotatedRefreshCookie).not.toBe(initialRefreshCookie)

    const reusedRefreshResponse = await postRequest('/api/v1/auth/refresh', {
      Cookie: initialRefreshCookie,
    })
    expect(reusedRefreshResponse.status).toBe(401)

    const logoutResponse = await postRequest('/api/v1/auth/logout', {
      Authorization: `Bearer ${refreshed.accessToken}`,
      Cookie: rotatedRefreshCookie,
    })
    expect(logoutResponse.status).toBe(200)

    const loggedOutRefreshResponse = await postRequest('/api/v1/auth/refresh', {
      Cookie: rotatedRefreshCookie,
    })
    expect(loggedOutRefreshResponse.status).toBe(401)
  })
})
