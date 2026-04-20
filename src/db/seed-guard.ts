type SeedEnv = {
  NODE_ENV?: string
  ALLOW_DEMO_SEED?: string
}

export function isDemoSeedAllowed(env: SeedEnv): boolean {
  return env.NODE_ENV !== 'production' || env.ALLOW_DEMO_SEED === 'true'
}

export function assertDemoSeedAllowed(env: SeedEnv): void {
  if (isDemoSeedAllowed(env)) return

  throw new Error('Refusing to seed demo users in production. Set ALLOW_DEMO_SEED=true to override.')
}
