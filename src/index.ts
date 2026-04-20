import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'
import { rateLimit } from 'elysia-rate-limit'
import { JWT_CONFIG } from './lib/config'
import { authModule } from './modules/auth'

const app = new Elysia()
  .use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }))
  .use(jwt(JWT_CONFIG))
  .use(rateLimit())
  .get('/health', () => 'OK')
  .use(authModule)
  .listen(process.env.PORT ?? 3000)

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
