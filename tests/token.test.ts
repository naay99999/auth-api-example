import { describe, expect, test } from 'bun:test'
import { generateRefreshToken } from '../src/lib/token'

describe('generateRefreshToken', () => {
  test('returns URL-safe high-entropy tokens', () => {
    const token = generateRefreshToken()

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBeGreaterThanOrEqual(43)
  })

  test('returns unique tokens across a sample', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateRefreshToken()))

    expect(tokens.size).toBe(100)
  })
})
