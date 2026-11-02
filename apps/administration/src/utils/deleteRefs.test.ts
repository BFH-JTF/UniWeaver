import { describe, expect, it } from 'vitest'
import type { EntityReferenceFinding } from '@uniweaver/shared'
import { isReferencesBody, severityTitle } from './deleteRefs'

function finding(severity: EntityReferenceFinding['severity'], label = 'X'): EntityReferenceFinding {
  return { key: 'k', label, severity, count: 1, sampleNames: [] }
}

describe('severityTitle', () => {
  it('explains cascade deletions', () => {
    expect(severityTitle(finding('cascade', 'Degrees of this level'))).toBe('Will also be deleted: Degrees of this level')
  })

  it('explains broken references', () => {
    expect(severityTitle(finding('breaks', 'Modules'))).toBe('Referenced by: Modules — references will be cleaned')
  })

  it('explains cleanups', () => {
    expect(severityTitle(finding('cleanup', 'Acl rows'))).toBe('Will be cleaned up: Acl rows')
  })
})

describe('isReferencesBody', () => {
  it('accepts bodies with a references array', () => {
    expect(isReferencesBody({ references: [finding('cleanup')] })).toBe(true)
  })

  it('rejects non-objects and objects without references', () => {
    expect(isReferencesBody(null)).toBe(false)
    expect(isReferencesBody('oops')).toBe(false)
    expect(isReferencesBody({})).toBe(false)
    expect(isReferencesBody({ references: 'all' })).toBe(false)
  })

  it('is a type guard usable in catch handlers', () => {
    const body: unknown = { references: [finding('breaks')] }
    if (isReferencesBody(body)) {
      expect(body.references).toHaveLength(1)
    } else {
      throw new Error('guard failed')
    }
  })
})