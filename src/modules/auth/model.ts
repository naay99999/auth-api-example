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
  user: t.Object({
    id: t.String({ description: 'User ULID' }),
    email: t.String({ format: 'email' }),
    name: t.String(),
  }),
  profile: t.Object({
    id: t.String({ description: 'User ULID' }),
    email: t.String({ format: 'email' }),
    name: t.String(),
    createdAt: t.String({
      format: 'date-time',
      description: 'ISO 8601 creation timestamp',
    }),
  }),
  authResponse: t.Object({
    user: t.Object({
      id: t.String({ description: 'User ULID' }),
      email: t.String({ format: 'email' }),
      name: t.String(),
    }),
    accessToken: t.String({ description: 'JWT access token' }),
    expiresIn: t.Number({ description: 'Access token lifetime in seconds' }),
  }),
  refreshResponse: t.Object({
    accessToken: t.String({ description: 'JWT access token' }),
    expiresIn: t.Number({ description: 'Access token lifetime in seconds' }),
  }),
  messageResponse: t.Object({
    message: t.String(),
  }),
  validationError: t.Unknown({
    description: 'Elysia/TypeBox validation error',
  }),
  textError: t.String(),
}

export type RegisterDTO = typeof AuthModel.register.static
export type LoginDTO = typeof AuthModel.login.static
