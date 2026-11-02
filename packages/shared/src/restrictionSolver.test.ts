import { describe, expect, it } from 'vitest'
import { dedupeEffectiveRestrictions } from './restrictionSolver'
import { isRestrictableTable, PRIORITY_LEVELS, validateRestrictionParams } from './restrictions'
import type { EffectiveRestriction } from './restrictionSolver'

function eff(id: string, table = 'modules', entityId = 'e1'): EffectiveRestriction {
  return {
    id,
    table,
    entityId,
    ruleType: 'module_no_overlap',
    params: {},
    enabled: true,
    weight: 3,
  } as EffectiveRestriction
}

describe('dedupeEffectiveRestrictions', () => {
  it('keeps unique ids', () => {
    const list = [eff('r1'), eff('r2')]
    expect(dedupeEffectiveRestrictions(list)).toHaveLength(2)
  })

  it('drops entries with the same table:entity:id key, keeping the first', () => {
    const list = [eff('r1'), eff('r1'), eff('r2')]
    const out = dedupeEffectiveRestrictions(list)
    expect(out.map(r => r.id)).toEqual(['r1', 'r2'])
  })

  it('keeps same id across different entities or tables', () => {
    const list = [eff('r1'), eff('r1', 'modules', 'e2'), eff('r1', 'classes', 'e1')]
    expect(dedupeEffectiveRestrictions(list)).toHaveLength(3)
  })

  it('tolerates empty lists', () => {
    expect(dedupeEffectiveRestrictions([])).toEqual([])
  })
})

describe('PRIORITY_LEVELS', () => {
  it('documents five levels, 5 = mandatory', () => {
    expect(PRIORITY_LEVELS).toHaveLength(5)
    expect(PRIORITY_LEVELS.map(l => l.value)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('isRestrictableTable / validateRestrictionParams', () => {
  it('only curriculum tables are restrictable', () => {
    expect(isRestrictableTable('modules')).toBe(true)
    expect(isRestrictableTable('programs')).toBe(true)
    expect(isRestrictableTable('todos')).toBe(false)
  })

  it('validateRestrictionParams rejects unknown types and non-objects', () => {
    expect(validateRestrictionParams('nonexistent', {})).toMatch(/Unknown/)
    expect(validateRestrictionParams('module_no_overlap', null)).toMatch(/object/)
  })
})
import { buildSchedulingRulesForPairing } from './restrictionSolver'
import type { RestrictionTreeInput } from './restrictionSolver'

/** Minimal valid tree: module root + one degree + one program + department. */
function fixtureTree(): RestrictionTreeInput {
  const restriction = (id: string, ruleType: string, weight = 3, params: Record<string, unknown> = {}) => ({
    id,
    table: 'modules',
    entityId: 'm1',
    ruleType,
    params,
    enabled: true,
    weight,
  })
  const departmentNode = { restrictions: [restriction('d-r1', 'allowed_weekdays', 4, { weekdays: ['friday'] })] }
  const programNode = { restrictions: [], departments: departmentNode }
  const degreeNode = { restrictions: [restriction('deg-r1', 'excluded_dates', 5, { dates: ['2027-03-04'] })], programs: [programNode] }
  return {
    module: { restrictions: [restriction('m-r1', 'allowed_weekdays', 2, { weekdays: ['thursday'] })], degrees: [degreeNode] },
    class: { restrictions: [], degree: null },
  }
}

describe('buildSchedulingRulesForPairing', () => {
  it('emits solver rules for rule types present in the module tree', () => {
    const rules = buildSchedulingRulesForPairing(fixtureTree())
    const types = rules.map(r => r.ruleType)
    expect(types).toContain('ALLOWED_WEEKDAYS')
    expect(types).toContain('UNAVAILABLE_DATES')
    expect(rules.every(r => r.enabled)).toBe(true)
  })

  it('takes the highest weight per rule type (most-restrictive wins)', () => {
    const rules = buildSchedulingRulesForPairing(fixtureTree())
    const weekdays = rules.find(r => r.ruleType === 'ALLOWED_WEEKDAYS')!
    expect(weekdays.weight).toBe(4)
    expect(weekdays.id).toContain('+')
  })

  it('maps params through unchanged-ish (merged) for each rule', () => {
    const rules = buildSchedulingRulesForPairing(fixtureTree())
    const weekdays = rules.find(r => r.ruleType === 'ALLOWED_WEEKDAYS')!
    expect(weekdays.params).toBeDefined()
    const dates = rules.find(r => r.ruleType === 'UNAVAILABLE_DATES')!
    expect(dates.params).toMatchObject({ dates: ['2027-03-04'] })
  })

  it('returns [] when neither tree carries restrictions', () => {
    const tree = fixtureTree()
    tree.module.restrictions = []
    tree.module.degrees = []
    tree.class.restrictions = []
    expect(buildSchedulingRulesForPairing(tree)).toEqual([])
  })
})
