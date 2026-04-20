if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required')
}

export const JWT_CONFIG = {
  name: 'jwt',
  secret: process.env.JWT_SECRET,
  exp: '15m',
} as const
