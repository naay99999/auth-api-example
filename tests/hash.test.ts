import { describe, expect, test } from 'bun:test'
import { hashToken } from '../src/lib/hash'

describe('hashToken', () => {
  test('returns deterministic SHA-256 hex output', async () => {
    const first = await hashToken('refresh-token')
    const second = await hashToken('refresh-token')

    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })
})
