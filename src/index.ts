import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'
import { openapi } from '@elysiajs/openapi'
import { JWT_CONFIG } from './lib/config'
import { shouldEnableOpenApi } from './lib/docs'
import { authModule } from './modules/auth'

if (!process.env.CLIENT_ORIGIN) {
  throw new Error('CLIENT_ORIGIN is required')
}

const app = (
  shouldEnableOpenApi(process.env.NODE_ENV)
    ? new Elysia().use(
        openapi({
          path: '/api/v1/docs',
          specPath: '/api/v1/docs/json',
          provider: 'scalar',
          scalar: {
            url: '/api/v1/docs/json',
          },
          documentation: {
            info: {
              title: 'Auth API Example',
              version: '1.0.50',
            },
            tags: [
              { name: 'Health', description: 'Service health checks' },
              { name: 'Auth', description: 'Authentication endpoints' },
            ],
            components: {
              securitySchemes: {
                bearerAuth: {
                  type: 'http',
                  scheme: 'bearer',
                  bearerFormat: 'JWT',
                },
                refreshCookie: {
                  type: 'apiKey',
                  in: 'cookie',
                  name: 'refresh_token',
                },
              },
            },
          },
        }),
      )
    : new Elysia()
)
  .use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))
  .use(jwt(JWT_CONFIG))
  .get('/health', () => 'OK' as const, {
    response: {
      200: t.Literal('OK'),
    },
    detail: {
      summary: 'Health check',
      description: 'Check that the API server is running.',
      tags: ['Health'],
    },
  })
  .use(authModule)
  .listen(process.env.PORT ?? 3000)

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
