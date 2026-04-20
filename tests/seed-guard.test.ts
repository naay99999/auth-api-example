import { describe, expect, test } from 'bun:test'
import { assertDemoSeedAllowed, isDemoSeedAllowed } from '../src/db/seed-guard'

describe('demo seed guard', () => {
  test('allows non-production environments', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'development' })).toBe(true)
    expect(isDemoSeedAllowed({ NODE_ENV: 'test' })).toBe(true)
    expect(isDemoSeedAllowed({})).toBe(true)
  })

  test('blocks production by default', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'production' })).toBe(false)
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'production' })).toThrow(
      'Refusing to seed demo users in production',
    )
  })

  test('allows production only with explicit override', () => {
    expect(isDemoSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' })).toBe(true)
  })
})
