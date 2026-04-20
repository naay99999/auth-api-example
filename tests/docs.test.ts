import { describe, expect, test } from 'bun:test'
import { shouldEnableOpenApi } from '../src/lib/docs'

describe('shouldEnableOpenApi', () => {
  test('enables docs outside production', () => {
    expect(shouldEnableOpenApi('development')).toBe(true)
    expect(shouldEnableOpenApi('test')).toBe(true)
    expect(shouldEnableOpenApi(undefined)).toBe(true)
  })

  test('disables docs in production', () => {
    expect(shouldEnableOpenApi('production')).toBe(false)
  })
})
