import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'
import { openapi } from '@elysiajs/openapi'
import { JWT_CONFIG } from './lib/config'
import { shouldEnableOpenApi } from './lib/docs'
import { createAuthModule } from './modules/auth'

type CreateAppOptions = {
  clientOrigin?: string
  enableOpenApi?: boolean
  enableRateLimit?: boolean
}

function createBaseApp(enableOpenApi: boolean) {
  if (!enableOpenApi) return new Elysia()

  return new Elysia().use(
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
}

export function createApp(options: CreateAppOptions = {}) {
  const clientOrigin = options.clientOrigin ?? process.env.CLIENT_ORIGIN
  if (!clientOrigin) {
    throw new Error('CLIENT_ORIGIN is required')
  }

  const enableOpenApi = options.enableOpenApi ?? shouldEnableOpenApi(process.env.NODE_ENV)
  const enableRateLimit = options.enableRateLimit ?? true

  return createBaseApp(enableOpenApi)
    .use(cors({ origin: clientOrigin, credentials: true }))
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
    .use(createAuthModule({ enableRateLimit }))
}
