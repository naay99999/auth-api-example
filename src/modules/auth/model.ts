import { t } from 'elysia'

export const AuthModel = {
  register: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 8 }),
    name: t.String({ minLength: 1 }),
  }),
  login: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String(),
  }),
}

export type RegisterDTO = typeof AuthModel.register.static
export type LoginDTO = typeof AuthModel.login.static
