import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { bearer } from '@elysiajs/bearer'
import { rateLimit } from 'elysia-rate-limit'
import { JWT_CONFIG } from '../../lib/config'
import { AuthModel } from './model'
import { AuthService } from './service'

const ACCESS_TOKEN_EXPIRES_IN = 900 // seconds, matches JWT_CONFIG exp '15m'

const authPlugin = new Elysia({ name: 'Auth.Plugin' })
  .use(jwt(JWT_CONFIG))
  .use(bearer())
  .macro({
    isAuth: {
      async resolve({ bearer, jwt, status }) {
        if (!bearer) return status(401, 'Unauthorized')
        const payload = await jwt.verify(bearer)
        if (!payload) return status(401, 'Unauthorized')
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
    { body: 'auth.register' },
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
      use: [rateLimit({ max: 5, duration: 15 * 60 * 1000 })],
    },
  )
  .post('/refresh', async ({ cookie: { refresh_token }, jwt }) => {
    const result = await AuthService.refresh(refresh_token.value)
    if (!('userId' in result)) return result

    const accessToken = await jwt.sign({ sub: result.userId })
    refresh_token.set({ value: result.newRawToken, ...AuthService.cookieOptions() })

    return { accessToken, expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  })
  .post(
    '/logout',
    async ({ cookie: { refresh_token }, userId }: { userId: string; cookie: any }) => {
      await AuthService.logout(refresh_token.value, userId)
      refresh_token.remove()
      return { message: 'Logged out successfully' }
    },
    { isAuth: true },
  )
  .post(
    '/logout-all',
    async ({ userId }: { userId: string }) => {
      await AuthService.logoutAll(userId)
      return { message: 'All sessions revoked' }
    },
    { isAuth: true },
  )
  .get(
    '/me',
    ({ userId }: { userId: string }) => AuthService.getMe(userId),
    { isAuth: true },
  )
