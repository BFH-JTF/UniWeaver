import { describe, expect, it } from 'vitest'
import { isRestrictableTable, priorityLabel, validateRestrictionParams } from './restrictions'

describe('isRestrictableTable', () => {
  it('accepts the known curriculum tables', () => {
    expect(isRestrictableTable('modules')).toBe(true)
    expect(isRestrictableTable('classes')).toBe(true)
    expect(isRestrictableTable('degrees')).toBe(true)
  })

  it('rejects unknown tables and empty strings', () => {
    expect(isRestrictableTable('users')).toBe(false)
    expect(isRestrictableTable('')).toBe(false)
    expect(isRestrictableTable('MODULES')).toBe(false)
  })
})

describe('priorityLabel', () => {
  it('maps the five documented weights to stable labels', () => {
    expect(priorityLabel(1)).toBe('Nice-to-have')
    expect(priorityLabel(3)).toBe('Standard importance')
    expect(priorityLabel(5)).toBe('Mandatory condition')
  })

  it('returns "" for weights outside 1..5 (incl. 0 and negatives)', () => {
    expect(priorityLabel(0)).toBe('')
    expect(priorityLabel(-1)).toBe('')
    expect(priorityLabel(9)).toBe('')
  })
})

describe('validateRestrictionParams', () => {
  it('returns an error string for unknown rule types', () => {
    expect(validateRestrictionParams('completely_unknown_rule', {})).toMatch(/Unknown restriction type/)
  })

  it('rejects non-object params with a clear message', () => {
    expect(validateRestrictionParams('module_no_overlap', 'not-an-object')).toMatch(/params must be an object/)
    expect(validateRestrictionParams('module_no_overlap', null)).toMatch(/params must be an object/)
    expect(validateRestrictionParams('module_no_overlap', [1, 2])).toMatch(/params must be an object/)
  })

  it('does not throw on odd inputs', () => {
    expect(() => validateRestrictionParams('', { foo: 'bar' })).not.toThrow()
  })
})