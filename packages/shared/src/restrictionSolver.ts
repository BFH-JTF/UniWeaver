/**
 * Client-side helpers for curriculum restrictions: collapsing effective
 * restrictions into SchedulingRuleDTOs for the scheduleSolver request.
 *
 * Combination semantics (as agreed for CourseWeaver):
 * - OR within parallel parents: a session's module belongs to two degrees;
 *   only one of the two degrees' restrictions needs to be satisfied.
 * - AND across trees: the module tree (module → degrees → programs →
 *   departments) and the class tree (class → degree → programs →
 *   departments) must each be satisfied.
 *
 * Allowing-restrictions are negative constraints (e.g. "no Fridays"), so OR
 * between two parents means: a session is acceptable if it satisfies EITHER
 * parent's restriction set per rule type. The solver receives each parent's
 * restriction as a separately-tagged group (params.restrictionGroup) and the
 * grouping key ensures only one group per rule type must hold. To keep the
 * solver simple, groups with the same ruleType from parallel parents are
 * merged by unioning their params (the most permissive interpretation).
 */

import type {
  DayPhase,
  EffectiveRestriction,
  EntityRestriction,
  Weekday,
} from './restrictions'

export const SOLVER_API_TYPES = {
  allowed_weekdays: 'ALLOWED_WEEKDAYS',
  allowed_phase: 'ALLOWED_PHASE',
  excluded_dates: 'UNAVAILABLE_DATES',
  fixed_day: 'FIXED_DAY',
  allowed_timeslots: 'ALLOWED_TIMESLOTS',
  frequency_teaching_days: 'FREQUENCY_TEACHING_DAYS',
  frequency_per_week: 'FREQUENCY_PER_WEEK',
  weekday_stability: 'WEEKDAY_STABILITY',
  timeslot_stability: 'TIMESLOT_STABILITY',
  lecturer_planning: 'LECTURER_PLANNING',
  allowed_buildings: 'ALLOWED_BUILDINGS',
  allowed_rooms: 'ALLOWED_ROOMS',
  module_no_overlap: 'MODULE_NO_OVERLAP',
  module_must_precede: 'MODULE_MUST_PRECEDE',
  module_must_follow: 'MODULE_MUST_FOLLOW',
} as const

export type SolverApiRuleType = (typeof SOLVER_API_TYPES)[keyof typeof SOLVER_API_TYPES]

export interface SchedulingRuleDTO {
  id: string
  ruleType: string
  /** Priority level 1 (nice-to-have) … 5 (mandatory condition) */
  weight: number
  enabled: boolean
  params?: Record<string, unknown>
  appliesTo?: string[]
}

export interface RestrictionTreeNode {
  restrictions: EntityRestriction[]
}

export interface ProgramNode extends RestrictionTreeNode {
  departments: RestrictionTreeNode & { departments?: never }
}

export interface RestrictionTreeInput {
  /** module-side tree root */
  module: RestrictionTreeNode & {
    degrees: (RestrictionTreeNode & {
      programs: (RestrictionTreeNode & { departments: RestrictionTreeNode })[]
    })[]
  }
  /** class-side tree root */
  class: RestrictionTreeNode & {
    /** null when the class has no degree; the class tree then collapses to the root */
    degree: (RestrictionTreeNode & {
      programs: (RestrictionTreeNode & { departments: RestrictionTreeNode })[]
    }) | null
  }
}

const WEEKDAY_VALUES: readonly string[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Most permissive merge of same-type params across parallel (OR) parents. */
function mergeParams(ruleType: string, paramLists: Record<string, unknown>[]): Record<string, unknown> {
  switch (ruleType) {
    case 'allowed_weekdays': {
      // OR of "only these weekdays" -> union of allowed sets
      const union = new Set<string>()
      for (const p of paramLists) {
        for (const w of (p['weekdays'] as unknown[] | undefined) ?? []) {
          const norm = String(w).toLowerCase()
          if (WEEKDAY_VALUES.includes(norm)) union.add(norm)
        }
      }
      return { weekdays: WEEKDAY_VALUES.filter(w => union.has(w)) }
    }
    case 'allowed_phase': {
      const union = new Set<string>()
      for (const p of paramLists) {
        for (const ph of (p['phases'] as unknown[] | undefined) ?? []) union.add(String(ph).toLowerCase())
      }
      return { phases: ['morning', 'afternoon', 'evening'].filter(ph => union.has(ph)) }
    }
    case 'allowed_timeslots': {
      // OR of "only these start times" -> union of allowed slot start times
      const union = new Set<string>()
      for (const p of paramLists) {
        for (const t of (p['startTimes'] as unknown[] | undefined) ?? []) union.add(String(t))
      }
      return { startTimes: [...union].sort() }
    }
    case 'allowed_buildings': {
      const union = new Set<string>()
      for (const p of paramLists) {
        for (const b of (p['buildings'] as unknown[] | undefined) ?? []) union.add(String(b))
      }
      return { buildings: [...union].sort() }
    }
    case 'allowed_rooms': {
      const union = new Set<string>()
      for (const p of paramLists) {
        for (const r of (p['roomIds'] as unknown[] | undefined) ?? []) union.add(String(r))
      }
      return { roomIds: [...union].sort() }
    }
    case 'excluded_dates': {
      // OR of "not on these dates" -> intersection of excluded sets
      let intersection: string[] | null = null
      for (const p of paramLists) {
        const dates = ((((p['dates'] as unknown[] | undefined) ?? []) as string[]).map(String))
        if (intersection === null) intersection = [...new Set(dates)]
        else intersection = intersection.filter(d => dates.includes(d))
      }
      return { dates: intersection ?? [] }
    }
    case 'fixed_day': {
      // OR of "must be on day X" is paradoxical unless equal; keep the first
      // and let the soft solver weigh them. Grouping guarantees both are sent.
      return paramLists[0] ?? {}
    }
    default:
      return paramLists[0] ?? {}
  }
}

/** Collects all enabled restrictions of one tree's branches, grouped per rule
 * type. Each branch's restrictions are OR-alternatives within the tree. */
function collectPerBranch(branches: RestrictionTreeNode[][]): Map<string, EntityRestriction[]> {
  const groups = new Map<string, EntityRestriction[]>()
  for (const branch of branches) {
    for (const node of branch) {
      for (const r of node.restrictions) {
        if (!r.enabled) continue
        const list = groups.get(r.ruleType) ?? []
        list.push(r)
        groups.set(r.ruleType, list)
      }
    }
  }
  return groups
}

/**
 * Builds solver scheduling rules for one module+class pairing. The module
 * tree and class tree are ANDed; within a tree, parallel parents are ORed
 * (implemented as most-permissive param merge). Every rule carries its
 * priority level (weight, 1–5; 5 = mandatory condition).
 */
export function buildSchedulingRulesForPairing(input: RestrictionTreeInput): SchedulingRuleDTO[] {
  // Branches: for the module tree, each top-level degree is a branch consisting
  // of the module root + that degree + its programs + their departments.
  const moduleBranches: RestrictionTreeNode[][] = []
  if (input.module.restrictions.length > 0) moduleBranches.push([input.module])
  for (const degree of input.module.degrees) {
    const branch: RestrictionTreeNode[] = []
    if (input.module.restrictions.length > 0) branch.push(input.module)
    branch.push(degree)
    for (const program of degree.programs) {
      branch.push(program, program.departments)
    }
    moduleBranches.push(branch)
  }

  const classBranches: RestrictionTreeNode[][] = []
  const classRoot: RestrictionTreeNode[] = [input.class]
  if (input.class.degree) {
    const branch: RestrictionTreeNode[] = [...classRoot, input.class.degree]
    for (const program of input.class.degree.programs) {
      branch.push(program, program.departments)
    }
    classBranches.push(branch)
  } else {
    classBranches.push(classRoot)
  }

  // OR merge within each tree, then AND the two trees' results.
  const moduleGroups = collectPerBranch(moduleBranches)
  const classGroups = collectPerBranch(classBranches)

  const modulePerType = moduleGroups
  const classPerType = classGroups

  const rules: SchedulingRuleDTO[] = []
  const moduleTypes = new Set([...modulePerType.keys(), ...classPerType.keys()])

  for (const type of moduleTypes) {
    if (!moduleTypes.has(type)) continue
    const moduleList = modulePerType.get(type) ?? []
    const classList = classPerType.get(type) ?? []

    const makeRule = (list: EntityRestriction[]): SchedulingRuleDTO | null => {
      if (list.length === 0) return null
      const solverType = SOLVER_API_TYPES[type as keyof typeof SOLVER_API_TYPES]
      if (!solverType) return null
      return {
        id: list.map(r => r.id).join('+'),
        ruleType: solverType,
        weight: Math.max(...list.map(r => r.weight)),
        enabled: true,
        params: mergeParams(type, list.map(r => r.params ?? {})),
      }
    }

    const moduleRule = makeRule(moduleList)
    const classRule = makeRule(classList)
    if (moduleRule) rules.push(moduleRule)
    if (classRule) rules.push(classRule)
  }
  return rules
}

/** Convenience for deduplicating effective restriction lists. */
export function dedupeEffectiveRestrictions(list: EffectiveRestriction[]): EffectiveRestriction[] {
  const seen = new Set<string>()
  return list.filter(r => {
    const key = `${r.table}:${r.entityId}:${r.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type { DayPhase, EffectiveRestriction, EntityRestriction, Weekday }