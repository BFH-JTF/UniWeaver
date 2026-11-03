import { describe, expect, it } from 'vitest'
import type { ReferenceTargetSpec } from '@/types/csvImport'
import {
  MISSING_TOKEN,
  collectReferenceIssues,
  isValidReferenceToken,
  referenceFields,
  resolveMappedRows,
  type ReferenceResolutions,
} from './csvReferenceResolution'
import { IMPORT_CONFIGS } from './csvSchemas'

// The modules import references the degrees table (admin-gated, required —
// see IMPORT_CONFIGS.modules).
const degreesTarget: ReferenceTargetSpec = {
  entityTable: 'degrees',
  entityLabel: 'Degree',
  required: true,
  requireAdmin: true,
}

// Import rows resolve against this list. Only entities flagged _isAdmin may
// be picked by non-admins (the app's requireAdmin gate).
const targets = {
  degrees: [
    { id: 'deg-admin', name: 'Admin degree', _isAdmin: true },
    { id: 'deg-b', name: 'Plain degree', _isAdmin: false },
  ],
}

describe('isValidReferenceToken', () => {
  it('accepts known admin-gated ids for non-admins when flagged _isAdmin', () => {
    expect(isValidReferenceToken(degreesTarget, 'deg-admin', targets, false)).toBe(true)
  })

  it('rejects ids missing the admin flag for non-admins, but accepts them for admins', () => {
    expect(isValidReferenceToken(degreesTarget, 'deg-b', targets, false)).toBe(false)
    expect(isValidReferenceToken(degreesTarget, 'deg-b', targets, true)).toBe(true)
  })

  it('rejects unknown ids', () => {
    expect(isValidReferenceToken(degreesTarget, 'nope', targets, true)).toBe(false)
  })

  it('tolerates empty target lists', () => {
    expect(isValidReferenceToken(degreesTarget, 'deg-admin', {}, false)).toBe(false)
  })
})

describe('referenceFields', () => {
  it('returns only the reference-carrying fields of a type', () => {
    for (const f of referenceFields('modules')) expect(f.reference).toBeDefined()
    expect(referenceFields('modules').map(f => f.key)).toContain('DegreeIDs')
  })
})

describe('resolveMappedRows', () => {
  const rows = [
    { name: 'M1', DegreeIDs: 'deg-admin' },
    { name: 'M2', DegreeIDs: 'unknown' },
    { name: 'M3', DegreeIDs: '' },
  ]

  it('keeps valid tokens and leaves invalid ones in place', () => {
    const rowsOut = resolveMappedRows('modules', rows, targets, false)
    expect(rowsOut[0]!.DegreeIDs).toBe('deg-admin')
    expect(rowsOut[1]!.DegreeIDs).toBe('unknown')
    expect(rowsOut[2]!.DegreeIDs).toBe('') // required ref with no token and no resolution
  })

  it('applies MISSING_TOKEN resolutions for empty mandatory cells', () => {
    const resolutions: ReferenceResolutions = { [`DegreeIDs:${MISSING_TOKEN}`]: ['deg-admin'] }
    const rowsOut = resolveMappedRows('modules', rows, targets, false, resolutions)
    expect(rowsOut[2]!.DegreeIDs).toBe('deg-admin')
  })

  it('replaces invalid tokens through recorded resolutions', () => {
    const resolutions: ReferenceResolutions = { 'DegreeIDs:unknown': ['deg-admin'] }
    const rowsOut = resolveMappedRows('modules', rows, targets, false, resolutions)
    expect(rowsOut[1]!.DegreeIDs).toBe('deg-admin')
  })

  it('keeps multi-token cells joined by | when all tokens resolve', () => {
    const rowsOut = resolveMappedRows('modules', [{ name: 'M', DegreeIDs: 'deg-admin|deg-admin' }], targets, false)
    expect(rowsOut[0]!.DegreeIDs).toBe('deg-admin|deg-admin')
  })

  it('blanks required refs on rows without tokens (required-field semantics)', () => {
    expect(resolveMappedRows('modules', [{ a: '1' }], targets, false)).toEqual([{ a: '1', DegreeIDs: '' }])
  })

  it('does not mutate its input', () => {
    const input = [{ name: 'M1', DegreeIDs: 'deg-admin' }]
    resolveMappedRows('modules', input, targets, false)
    expect(input).toEqual([{ name: 'M1', DegreeIDs: 'deg-admin' }])
  })

  it('tolerates empty inputs', () => {
    expect(resolveMappedRows('modules', [], targets, false, {})).toEqual([])
  })
})

describe('collectReferenceIssues', () => {
  it('groups invalid tokens per field with row indices', () => {
    const mapped = resolveMappedRows('modules', [
      { name: 'M1', DegreeIDs: 'nope' },
      { name: 'M2', DegreeIDs: 'nope' },
    ], targets, false)
    const issues = collectReferenceIssues('modules', mapped, targets, false, {})
    expect(issues).toHaveLength(1)
    const issue = issues[0]!
    expect(issue.fieldKey).toBe('DegreeIDs')
    expect(issue.token).toBe('nope')
    expect(issue.rowIndices).toEqual([0, 1])
    expect(issue.key).toBe(`DegreeIDs:nope`)
  })

  it('counts empty mandatory cells as MISSING_TOKEN issues', () => {
    const mapped = resolveMappedRows('modules', [{ name: 'M', DegreeIDs: '' }], targets, false)
    const issues = collectReferenceIssues('modules', mapped, targets, false, {})
    expect(issues).toHaveLength(1)
    expect(issues[0]!.token).toBe(MISSING_TOKEN)
  })

  it('returns [] once everything resolves', () => {
    expect(collectReferenceIssues('modules', [], targets, false, {})).toEqual([])
    expect(collectReferenceIssues('modules', [{ name: 'M', DegreeIDs: 'deg-admin' }], targets, false, {})).toEqual([])
  })

  it('honours recorded resolutions when scanning', () => {
    const resolutions: ReferenceResolutions = { 'DegreeIDs:nope': ['deg-admin'] }
    const mapped = resolveMappedRows('modules', [{ name: 'M1', DegreeIDs: 'nope' }], targets, false, resolutions)
    expect(collectReferenceIssues('modules', mapped, targets, false, resolutions)).toEqual([])
  })
})

describe('IMPORT_CONFIGS reference specs', () => {
  it('modules carry at least one admin-gated degree reference', () => {
    const fields = IMPORT_CONFIGS.modules.fields.filter(f => f.reference)
    expect(fields.length).toBeGreaterThan(0)
    expect(fields.some(f => f.reference!.entityTable === 'degrees')).toBe(true)
  })
})