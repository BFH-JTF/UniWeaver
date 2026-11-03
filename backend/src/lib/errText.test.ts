import { describe, expect, it } from 'vitest'
import { errText } from './errText'

describe('errText', () => {
  it('keeps an Error object\'s message', () => {
    expect(errText(new Error('boom'))).toBe('boom')
  })

  it('handles Error subclasses (ApiRequestError pattern)', () => {
    class MyError extends Error {}
    expect(errText(new MyError('nested'))).toBe('nested')
  })

  it('passes plain strings through', () => {
    expect(errText('plain failure')).toBe('plain failure')
  })

  it('returns "" for non-string non-Error values (fallback triggers downstream)', () => {
    expect(errText(undefined)).toBe('')
    expect(errText(null)).toBe('')
    expect(errText(42)).toBe('')
    expect(errText({ message: 'not an error' })).toBe('')
  })

  it('returns "" for empty strings so callers can apply their default text', () => {
    expect(errText('')).toBe('')
    expect(errText(new Error(''))).toBe('')
  })

  it('handles Unicode messages', () => {
    expect(errText(new Error('Fehler: Datenbank ✗'))).toBe('Fehler: Datenbank ✗')
  })
})