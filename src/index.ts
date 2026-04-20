import { createApp } from './app'

const app = createApp().listen(process.env.PORT ?? 3000)

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
