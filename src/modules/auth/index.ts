import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { rateLimit } from 'elysia-rate-limit'
import { JWT_CONFIG } from '../../lib/config'
import { AuthModel } from './model'
import { AuthService } from './service'

const ACCESS_TOKEN_EXPIRES_IN = 900 // seconds, matches JWT_CONFIG exp '15m'

function getRefreshTokenValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

const authPlugin = new Elysia({ name: 'Auth.Plugin' })
  .use(jwt(JWT_CONFIG))
  .use(bearer())
  .macro({
    isAuth: {
      async resolve({ bearer, jwt, status }) {
        if (!bearer) return status(401, 'Unauthorized')
        const payload = await jwt.verify(bearer)
        if (payload === false || !payload.sub) return status(401, 'Unauthorized')
        return { userId: payload.sub as string }
      },
    },
  })

export const authModule = new Elysia({ prefix: '/api/v1/auth' })
  .use(authPlugin)
  .model({ 'auth.register': AuthModel.register, 'auth.login': AuthModel.login })
  .post(
    '/register',
    async ({ body, jwt, cookie: { refresh_token }, status }) => {
      const result = await AuthService.register(body)
      if (!('userId' in result)) return result

      const rawToken = await AuthService.issueRefreshToken(result.userId)
      const accessToken = await jwt.sign({ sub: result.userId })

      refresh_token.set({ value: rawToken, ...AuthService.cookieOptions() })

      return status(201, {
        user: { id: result.userId, email: result.email, name: result.name },
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      })
    },
    {
      body: 'auth.register',
      response: {
        201: AuthModel.authResponse,
        409: AuthModel.textError,
        422: AuthModel.validationError,
        429: AuthModel.textError,
      },
      detail: {
        summary: 'Register user',
        description: 'Create a new user, issue an access token, and set a refresh token cookie.',
        tags: ['Auth'],
      },
      use: [rateLimit({ max: 5, duration: 15 * 60 * 1000 })],
    },
  )
  .post(
    '/login',
    async ({ body, jwt, cookie: { refresh_token } }) => {
      const result = await AuthService.login(body)
      if (!('userId' in result)) return result

      const rawToken = await AuthService.issueRefreshToken(result.userId)
      const accessToken = await jwt.sign({ sub: result.userId })

      refresh_token.set({ value: rawToken, ...AuthService.cookieOptions() })

      return {
        user: { id: result.userId, email: result.email, name: result.name },
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      }
    },
    {
      body: 'auth.login',
      response: {
        200: AuthModel.authResponse,
        401: AuthModel.textError,
        422: AuthModel.validationError,
        429: AuthModel.textError,
      },
      detail: {
        summary: 'Login user',
        description: 'Authenticate a user, issue an access token, and set a refresh token cookie.',
        tags: ['Auth'],
      },
      use: [rateLimit({ max: 5, duration: 15 * 60 * 1000 })],
    },
  )
  .post(
    '/refresh',
    async ({ cookie: { refresh_token }, jwt }) => {
      const result = await AuthService.refresh(getRefreshTokenValue(refresh_token.value))
      if (!('userId' in result)) return result

      const accessToken = await jwt.sign({ sub: result.userId })
      refresh_token.set({ value: result.newRawToken, ...AuthService.cookieOptions() })

      return { accessToken, expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    },
    {
      response: {
        200: AuthModel.refreshResponse,
        401: AuthModel.textError,
        429: AuthModel.textError,
      },
      detail: {
        summary: 'Refresh access token',
        description: 'Rotate the refresh token cookie and return a new access token.',
        tags: ['Auth'],
        security: [{ refreshCookie: [] }],
      },
      use: [rateLimit({ max: 10, duration: 15 * 60 * 1000 })],
    },
  )
  .post(
    '/logout',
    async ({ cookie: { refresh_token }, userId }) => {
      await AuthService.logout(getRefreshTokenValue(refresh_token.value), userId)
      refresh_token.remove()
      return { message: 'Logged out successfully' }
    },
    {
      isAuth: true,
      response: {
        200: AuthModel.messageResponse,
        401: AuthModel.textError,
      },
      detail: {
        summary: 'Logout current session',
        description: 'Revoke the current refresh token and clear the refresh token cookie.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    '/logout-all',
    async ({ userId, cookie: { refresh_token } }) => {
      await AuthService.logoutAll(userId)
      refresh_token.remove()
      return { message: 'All sessions revoked' }
    },
    {
      isAuth: true,
      response: {
        200: AuthModel.messageResponse,
        401: AuthModel.textError,
      },
      detail: {
        summary: 'Logout all sessions',
        description: 'Revoke all active refresh tokens for the authenticated user.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    '/me',
    ({ userId }) => AuthService.getMe(userId),
    {
      isAuth: true,
      response: {
        200: AuthModel.profile,
        401: AuthModel.textError,
      },
      detail: {
        summary: 'Get current user',
        description: 'Return the profile for the authenticated user.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
  )
