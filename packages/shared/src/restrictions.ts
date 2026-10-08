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
export const RESTRICTABLE_TABLES = ['curriculums', 'departments', 'programs', 'degrees', 'modules', 'classes'] as const
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

export type RestrictionParamType = 'weekdayArray' | 'phaseArray' | 'dateArray' | 'singleWeekday' | 'number' | 'choice' | 'timeslotArray' | 'buildingArray' | 'roomArray' | 'moduleArray'

/** Static options for 'choice' params (dynamic reference data uses dynamicOptions). */
export interface RestrictionChoiceOption {
  value: string
  label: string
}

/** Keys for option lists the GUI resolves from reference data at runtime. */
export type RestrictionDynamicOptions = 'semesterTimeslots' | 'buildings' | 'rooms' | 'modules'

export interface RestrictionParamSpec {
  key: string
  label: string
  type: RestrictionParamType
  required: boolean
  description: string
  /** for 'choice' params */
  options?: RestrictionChoiceOption[]
  /** for option-list params backed by reference data */
  dynamicOptions?: RestrictionDynamicOptions
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
  /** GUI grouping key (see RESTRICTION_GROUPS) */
  group?: RestrictionGroup
}

/** GUI group labels the restriction catalog is organized by. */
export const RESTRICTION_GROUPS = [
  'Time & place',
  'Frequency & stability',
  'Lecturer planning',
  'Module relations',
] as const
export type RestrictionGroup = (typeof RESTRICTION_GROUPS)[number]

const GROUP_BY_TYPE: Record<string, RestrictionGroup> = {
  allowed_weekdays: 'Time & place',
  allowed_phase: 'Time & place',
  allowed_timeslots: 'Time & place',
  excluded_dates: 'Time & place',
  fixed_day: 'Time & place',
  allowed_buildings: 'Time & place',
  allowed_rooms: 'Time & place',
  frequency_teaching_days: 'Frequency & stability',
  frequency_per_week: 'Frequency & stability',
  weekday_stability: 'Frequency & stability',
  timeslot_stability: 'Frequency & stability',
  lecturer_planning: 'Lecturer planning',
  module_no_overlap: 'Module relations',
  module_must_precede: 'Module relations',
  module_must_follow: 'Module relations',
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
  {
    value: 'allowed_timeslots',
    label: 'Allowed timeslots',
    description: 'Sessions may only start in the listed timeslots (slot start times of the semester grid).',
    category: 'hard',
    params: [
      {
        key: 'startTimes',
        label: 'Timeslots (start times)',
        type: 'timeslotArray',
        required: true,
        dynamicOptions: 'semesterTimeslots',
        description: 'Slot start times (HH:MM) in which sessions are allowed to start.',
      },
    ],
    solverRuleType: 'ALLOWED_TIMESLOTS',
    icon: 'mdi-clock-outline',
  },
  {
    value: 'frequency_teaching_days',
    label: 'Frequency: teaching day range',
    description: 'Minimum/maximum number of teaching days that must pass between two occurrences of the module.',
    category: 'soft',
    params: [
      {
        key: 'minDays',
        label: 'Minimum teaching days',
        type: 'number',
        required: true,
        description: 'Smallest number of teaching days between two module occurrences.',
      },
      {
        key: 'maxDays',
        label: 'Maximum teaching days',
        type: 'number',
        required: false,
        description: 'Largest number of teaching days between two module occurrences.',
      },
    ],
    solverRuleType: 'FREQUENCY_TEACHING_DAYS',
    icon: 'mdi-calendar-range',
  },
  {
    value: 'frequency_per_week',
    label: 'Frequency: per week',
    description: 'How often the module may be scheduled per calendar week (exact or a range).',
    category: 'soft',
    params: [
      {
        key: 'min',
        label: 'Minimum per week',
        type: 'number',
        required: true,
        description: 'Smallest number of sessions per calendar week.',
      },
      {
        key: 'max',
        label: 'Maximum per week',
        type: 'number',
        required: false,
        description: 'Largest number of sessions per calendar week.',
      },
    ],
    solverRuleType: 'FREQUENCY_PER_WEEK',
    icon: 'mdi-calendar-multiple-check',
  },
  {
    value: 'weekday_stability',
    label: 'Weekday stability',
    description: 'The module should be scheduled on the same weekday every time it takes place.',
    category: 'soft',
    params: [],
    solverRuleType: 'WEEKDAY_STABILITY',
    icon: 'mdi-calendar-lock',
  },
  {
    value: 'timeslot_stability',
    label: 'Timeslot stability',
    description: 'The module should be scheduled in the same timeslot every time it takes place.',
    category: 'soft',
    params: [],
    solverRuleType: 'TIMESLOT_STABILITY',
    icon: 'mdi-clock-check-outline',
  },
  {
    value: 'lecturer_planning',
    label: 'Lecturer planning',
    description: 'Whether one available lecturer is enough or the number of available lecturers should be maximized.',
    category: 'soft',
    params: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'choice',
        required: true,
        options: [
          { value: 'any_lecturer', label: 'Any lecturer (one available lecturer is enough)' },
          { value: 'max_lecturer', label: 'Max lecturer (maximize available lecturers)' },
        ],
        description: 'Lecturer planning mode for this module.',
      },
    ],
    solverRuleType: 'LECTURER_PLANNING',
    icon: 'mdi-account-group-outline',
  },
  {
    value: 'allowed_buildings',
    label: 'Allowed buildings',
    description: 'Sessions may only take place in the listed buildings.',
    category: 'hard',
    params: [
      {
        key: 'buildings',
        label: 'Buildings',
        type: 'buildingArray',
        required: true,
        dynamicOptions: 'buildings',
        description: 'Buildings in which sessions are allowed.',
      },
    ],
    solverRuleType: 'ALLOWED_BUILDINGS',
    icon: 'mdi-domain',
  },
  {
    value: 'allowed_rooms',
    label: 'Allowed rooms',
    description: 'Sessions may only take place in the listed rooms.',
    category: 'hard',
    params: [
      {
        key: 'roomIds',
        label: 'Rooms',
        type: 'roomArray',
        required: true,
        dynamicOptions: 'rooms',
        description: 'Rooms in which sessions are allowed.',
      },
    ],
    solverRuleType: 'ALLOWED_ROOMS',
    icon: 'mdi-door-open',
  },
  {
    value: 'module_no_overlap',
    label: 'Relation: no overlap',
    description: 'No other modules can be scheduled at the same time as this module (scope-limited).',
    category: 'hard',
    params: [
      {
        key: 'scope',
        label: 'Scope',
        type: 'choice',
        required: true,
        options: [
          { value: 'all', label: 'All other modules' },
          { value: 'sameDegree', label: 'No other modules of the same degree' },
          { value: 'sameProgram', label: 'No other modules of the same program' },
        ],
        description: 'Which overlapping sessions to forbid.',
      },
    ],
    solverRuleType: 'MODULE_NO_OVERLAP',
    icon: 'mdi-axis-arrow-info',
  },
  {
    value: 'module_must_precede',
    label: 'Relation: must precede',
    description: 'This module must be scheduled before (one of) the listed modules.',
    category: 'hard',
    params: [
      {
        key: 'moduleIds',
        label: 'Modules it precedes',
        type: 'moduleArray',
        required: true,
        dynamicOptions: 'modules',
        description: 'Modules that must come after this module.',
      },
    ],
    solverRuleType: 'MODULE_MUST_PRECEDE',
    icon: 'mdi-transfer-up',
  },
  {
    value: 'module_must_follow',
    label: 'Relation: must follow',
    description: 'This module must be scheduled after (one of) the listed modules.',
    category: 'hard',
    params: [
      {
        key: 'moduleIds',
        label: 'Modules it follows',
        type: 'moduleArray',
        required: true,
        dynamicOptions: 'modules',
        description: 'Modules that must come before this module.',
      },
    ],
    solverRuleType: 'MODULE_MUST_FOLLOW',
    icon: 'mdi-transfer-down',
  },
]

export const RESTRICTION_TYPES: Record<string, RestrictionTypeSpec> = Object.fromEntries(
  RESTRICTION_CATALOG.map(r => [r.value, r]),
)

// Assign the GUI group now that the catalog is fully declared.
for (const entry of RESTRICTION_CATALOG) {
  entry.group = GROUP_BY_TYPE[entry.value]
}

/** Hard restrictions ignore weight; soft restrictions use it as penalty weight. */
export const DEFAULT_SOFT_WEIGHT = 5

/**
 * Uniform priority scale for all restriction rules. Weight on an
 * EntityRestriction stores one of these levels; 5 = mandatory condition
 * (violation makes a schedule infeasible), 1 = nice to have.
 */
export const PRIORITY_LEVELS = [
  { value: 1, label: 'Nice-to-have', color: 'success' },
  { value: 2, label: 'Somewhat important', color: 'lime' },
  { value: 3, label: 'Standard importance', color: 'info' },
  { value: 4, label: 'Whenever possible', color: 'warning' },
  { value: 5, label: 'Mandatory condition', color: 'error' },
] as const

export const DEFAULT_PRIORITY = 3

/** Label for a stored weight/priority value ('' for unknown values). */
export function priorityLabel(weight: number): string {
  return PRIORITY_LEVELS.find(l => l.value === weight)?.label ?? ''
}

export interface EntityRestriction {
  id: string
  table: string
  entityId: string
  ruleType: string
  params: Record<string, unknown>
  enabled: boolean
  /** Priority level 1 (nice-to-have) … 5 (mandatory condition) */
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
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false
  const [y, m, d] = parts as [number, number, number]
  if (m < 1 || m > 12) return false
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d >= 1 && d <= daysInMonth
}

/** Slot start times use 24h HH:MM with 00–23 h and 00–59 min. */
function isValidSlotTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const h = Number(match[1])
  const m = Number(match[2])
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
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
      case 'number': {
        if (value === undefined || value === null || value === '') {
          if (param.required) return `Parameter "${param.key}" must be a number`
          break
        }
        const n = typeof value === 'string' ? Number(value) : value
        if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
          return `Parameter "${param.key}" must be a non-negative number`
        }
        break
      }
      case 'choice': {
        if (value === undefined || value === null || value === '') {
          if (param.required) return `Parameter "${param.key}" must be one of the allowed options`
          break
        }
        const allowed = (param.options ?? []).map(o => o.value)
        if (!allowed.includes(String(value))) {
          return `Parameter "${param.key}" must be one of: ${allowed.join(', ')}`
        }
        break
      }
      case 'timeslotArray': {
        if (!Array.isArray(value)) return `Parameter "${param.key}" must be an array`
        if (param.required && value.length === 0) return `Parameter "${param.key}" must not be empty`
        if (!value.every(v => isValidSlotTime(String(v)))) {
          return `Parameter "${param.key}" must contain only slot start times in HH:MM format`
        }
        break
      }
      case 'buildingArray': {
        if (!Array.isArray(value)) return `Parameter "${param.key}" must be an array`
        if (param.required && value.length === 0) return `Parameter "${param.key}" must not be empty`
        if (!value.every(v => String(v).trim().length > 0)) {
          return `Parameter "${param.key}" must contain only non-empty building names`
        }
        break
      }
      case 'roomArray':
      case 'moduleArray': {
        if (!Array.isArray(value)) return `Parameter "${param.key}" must be an array`
        if (param.required && value.length === 0) return `Parameter "${param.key}" must not be empty`
        if (!value.every(v => typeof v === 'string' && v.trim().length > 0)) {
          return `Parameter "${param.key}" must contain only non-empty entity ids`
        }
        break
      }
    }
  }
  // Cross-checks for range-type frequency restrictions.
  if (ruleType === 'frequency_per_week' || ruleType === 'frequency_teaching_days') {
    const minKey = ruleType === 'frequency_per_week' ? 'min' : 'minDays'
    const maxKey = ruleType === 'frequency_per_week' ? 'max' : 'maxDays'
    const rawMin = p[minKey]
    const rawMax = p[maxKey]
    const min = typeof rawMin === 'string' ? Number(rawMin) : rawMin
    const max = rawMax === undefined || rawMax === null || rawMax === ''
      ? undefined
      : (typeof rawMax === 'string' ? Number(rawMax) : rawMax)
    if (typeof min === 'number' && Number.isFinite(min)
      && typeof max === 'number' && Number.isFinite(max) && max < min) {
      return `Parameter "${maxKey}" must not be smaller than "${minKey}"`
    }
  }
  return null
}