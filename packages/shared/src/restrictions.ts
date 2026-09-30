/**
 * Curriculum restriction catalog: the single source of truth for which
 * scheduling restriction types exist, which parameters each one takes and how
 * they map onto the scheduleSolver's SchedulingRule ruleType values.
 *
 * Used by:
 * - the backend to validate ruleType + params on write
 * - the administration GUI to render typed parameter editors
 * - the scheduling app to build ScheduleRequest.schedulingRules
 */

/** Curriculum entity tables that can carry (and inherit) restrictions. */
export const RESTRICTABLE_TABLES = ['departments', 'programs', 'degrees', 'modules', 'classes'] as const
export type RestrictableTable = (typeof RESTRICTABLE_TABLES)[number]

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export const WEEKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** The solver's phase model: morning / afternoon / evening per day. */
export type DayPhase = 'morning' | 'afternoon' | 'evening'

export const DAY_PHASES: DayPhase[] = ['morning', 'afternoon', 'evening']

/** Boundary the solver uses between phases (24h clock, minutes since midnight). */
export const PHASE_BOUNDARIES: Record<DayPhase, { start: number; end: number; label: string }> = {
  morning: { start: 8 * 60, end: 12 * 60, label: 'Morning (08:00–12:00)' },
  afternoon: { start: 12 * 60, end: 18 * 60, label: 'Afternoon (12:00–18:00)' },
  evening: { start: 18 * 60, end: 22 * 60, label: 'Evening (18:00–22:00)' },
}

export type RestrictionParamType = 'weekdayArray' | 'phaseArray' | 'dateArray' | 'singleWeekday'

export interface RestrictionParamSpec {
  key: string
  label: string
  type: RestrictionParamType
  required: boolean
  description: string
}

export interface RestrictionTypeSpec {
  /** canonical rule type key, stored in entity_restrictions.rule_type */
  value: string
  label: string
  description: string
  /** 'hard' restrictions cannot be relaxed; soft ones may be traded off via weight */
  category: 'hard' | 'soft'
  params: RestrictionParamSpec[]
  /** matching ruleType in the scheduleSolver SchedulingRule catalog */
  solverRuleType: string
  icon: string
}

export const RESTRICTION_CATALOG: RestrictionTypeSpec[] = [
  {
    value: 'allowed_weekdays',
    label: 'Allowed weekdays',
    description: 'Sessions may only take place on the listed weekdays.',
    category: 'hard',
    params: [
      {
        key: 'weekdays',
        label: 'Weekdays',
        type: 'weekdayArray',
        required: true,
        description: 'Weekdays on which sessions are allowed.',
      },
    ],
    solverRuleType: 'ALLOWED_WEEKDAYS',
    icon: 'mdi-calendar-week',
  },
  {
    value: 'allowed_phase',
    label: 'Allowed time of day',
    description: 'Sessions may only take place in the listed phases of a day (morning/afternoon/evening).',
    category: 'hard',
    params: [
      {
        key: 'phases',
        label: 'Phases',
        type: 'phaseArray',
        required: true,
        description: 'Phases of the day in which sessions are allowed.',
      },
    ],
    solverRuleType: 'ALLOWED_PHASE',
    icon: 'mdi-weather-sunny',
  },
  {
    value: 'excluded_dates',
    label: 'Excluded dates',
    description: 'No sessions on the listed (calendar) dates, e.g. holidays or exam periods.',
    category: 'hard',
    params: [
      {
        key: 'dates',
        label: 'Dates',
        type: 'dateArray',
        required: true,
        description: 'Calendar dates (YYYY-MM-DD) on which no sessions may take place.',
      },
    ],
    solverRuleType: 'UNAVAILABLE_DATES',
    icon: 'mdi-calendar-remove',
  },
  {
    value: 'fixed_day',
    label: 'Fixed weekday',
    description: 'Sessions must take place on a single given weekday (soft; relaxable via priority).',
    category: 'soft',
    params: [
      {
        key: 'weekday',
        label: 'Weekday',
        type: 'singleWeekday',
        required: true,
        description: 'The weekday on which sessions should take place.',
      },
    ],
    solverRuleType: 'FIXED_DAY',
    icon: 'mdi-calendar-check',
  },
]

export const RESTRICTION_TYPES: Record<string, RestrictionTypeSpec> = Object.fromEntries(
  RESTRICTION_CATALOG.map(r => [r.value, r]),
)

/** Hard restrictions ignore weight; soft restrictions use it as penalty weight. */
export const DEFAULT_SOFT_WEIGHT = 5

export interface EntityRestriction {
  id: string
  table: string
  entityId: string
  ruleType: string
  params: Record<string, unknown>
  enabled: boolean
  /** 0 = hard for soft-catalog entries too (kept symmetric with SchedulingRule.weight) */
  weight: number
  createdAt?: string
  updatedAt?: string
}

/** An effective (own or inherited) restriction as returned by the backend. */
export interface EffectiveRestriction extends EntityRestriction {
  /** where this restriction came from, if inherited */
  inheritedFrom?: {
    table: string
    id: string
    name: string
  }
}

export function isRestrictableTable(value: string): value is RestrictableTable {
  return (RESTRICTABLE_TABLES as readonly string[]).includes(value)
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12) return false
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d >= 1 && d <= daysInMonth
}

/**
 * Validates params against the catalog spec. Returns an error message or null
 * when the params are valid. Used by the backend on write and by the GUI.
 */
export function validateRestrictionParams(ruleType: string, params: unknown): string | null {
  const spec = RESTRICTION_TYPES[ruleType]
  if (!spec) return `Unknown restriction type: ${ruleType}`
  if (params === null || params === undefined || typeof params !== 'object' || Array.isArray(params)) {
    return 'params must be an object'
  }
  const p = params as Record<string, unknown>
  for (const param of spec.params) {
    const value = p[param.key]
    switch (param.type) {
      case 'weekdayArray': {
        if (!Array.isArray(value)) return `Parameter "${param.key}" must be an array`
        if (param.required && value.length === 0) return `Parameter "${param.key}" must not be empty`
        if (!value.every(v => (WEEKDAYS as string[]).includes(String(v)))) {
          return `Parameter "${param.key}" must contain only weekdays`
        }
        break
      }
      case 'phaseArray': {
        if (!Array.isArray(value)) return `Parameter "${param.key}" must be an array`
        if (param.required && value.length === 0) return `Parameter "${param.key}" must not be empty`
        if (!value.every(v => (DAY_PHASES as string[]).includes(String(v)))) {
          return `Parameter "${param.key}" must contain only phases (morning/afternoon/evening)`
        }
        break
      }
      case 'dateArray': {
        if (!Array.isArray(value)) return `Parameter "${param.key}" must be an array`
        if (param.required && value.length === 0) return `Parameter "${param.key}" must not be empty`
        if (!value.every(v => isValidISODate(String(v)))) {
          return `Parameter "${param.key}" must contain only dates in YYYY-MM-DD format`
        }
        break
      }
      case 'singleWeekday': {
        if (param.required && (!(typeof value === 'string') || !(WEEKDAYS as string[]).includes(value))) {
          return `Parameter "${param.key}" must be a weekday`
        }
        break
      }
    }
  }
  return null
}