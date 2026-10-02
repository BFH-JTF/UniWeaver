# Curriculum Restrictions
Curriculum restrictions can be applied at department, program, degree, module, and class levels.
They are inherited, i.e., restrictions defined for a department will be applied to all programs and modules within that department.
They can combine any of the following restriction types.

**Caution:** If contradictory restrictions are defined, all of them will be applied, which will probably result in a failure to find a schedule, e.g., when a program defines Monday as the only valid day and a Module does the same for Friday.

Restrictions carry a **priority level** (weight) from 1 to 5: 1 = nice-to-have, 2 = somewhat important, 3 = standard importance, 4 = whenever possible, 5 = mandatory condition. Level 5 means the schedule is invalid when the rule is violated; levels 1–4 are preferences the scheduler trades off against each other (higher levels win).

The canonical machine-readable type keys are given in parentheses; every restriction is validated against these keys and its parameters on write.

## Time & place

### Weekday (`allowed_weekdays`)
Weekday defines the weekday(s) on which the module can be scheduled.
Parameters: `weekdays` — list of weekdays (e.g. `monday`, `friday`).

### Timeslot (`allowed_timeslots`)
Timeslot defines the timeslot(s) — the slot start times of the semester's timeslot grid — in which the module can be scheduled.
Parameters: `startTimes` — list of `HH:MM` slot start times from the semester grid (e.g. `08:00`, `10:15`).

### Time of Day Phase (`allowed_phase`)
Sessions may only take place in the listed phases of a day.
Parameters: `phases` — list of `morning` (08:00–12:00), `afternoon` (12:00–18:00), `evening` (18:00–22:00).

### Excluded Dates (`excluded_dates`)
No sessions on the listed calendar dates, e.g. holidays or exam periods.
Parameters: `dates` — list of calendar dates in `YYYY-MM-DD` format.

### Building (`allowed_buildings`)
Building defines the building(s) in which the module can be scheduled.
Parameters: `buildings` — list of building names (as defined on locations).

### Room(s) (`allowed_rooms`)
Room(s) defines the room(s) in which the module can be scheduled.
Parameters: `roomIds` — list of room IDs.

### Fixed Weekday (`fixed_day`)
Sessions should take place on a single given weekday (priority-selectable).
Parameters: `weekday` — one weekday.

## Frequency
Frequency defines how often modules need to take place.
The frequency can be defined the following ways:

### Teaching Day Range (`frequency_teaching_days`)
The range is either defined by a number or number range of days that need to pass between two module occurrences.
Parameters: `minDays` (required), `maxDays` (optional).
Examples:
- Every 2 teaching days
- Every 14–21 teaching days

### Frequency per Week (`frequency_per_week`)
Times a module can be scheduled in a calendar week.
Parameters: `min` (required), `max` (optional).
Examples:
- Exactly once a week
- Two to three times a week

## Stability

### Weekday Stability (`weekday_stability`)
Does the module need to be scheduled for the same weekday every time? (Yes/No — modeled as a restriction without parameters.)

### Timeslot Stability (`timeslot_stability`)
Does the module need to be scheduled for the same timeslot every time it takes place? (Yes/No — modeled as a restriction without parameters.)

## Lecturer Planning (`lecturer_planning`)
Lecturer Planning defines whether it is enough that one of the lecturers assigned to the module can teach the module.
Parameters: `mode` —
- `any_lecturer`: One available lecturer is enough.
- `max_lecturer`: The number of lecturers available to teach the module will be maximized.

## Relations to Other Modules
Relations define when the module can be scheduled in relation to other modules.

### No Overlap (`module_no_overlap`)
No other modules can be scheduled at the same time.
Parameters: `scope` —
- `all`: No other modules can be scheduled at the same time
- `sameDegree`: No other modules of the same degree at the same time
- `sameProgram`: No other modules of the same program at the same time

### Must Precede (`module_must_precede`)
This module must be scheduled before (one of) the given modules.
Parameters: `moduleIds` — list of module IDs.

### Must Follow (`module_must_follow`)
This module must be scheduled after (one of) the given modules.
Parameters: `moduleIds` — list of module IDs.

## Inheritance semantics
Restrictions are inherited along the curriculum hierarchy (department â†’ program â†’ degree â†’ module, class â†’ degree â†’ program â†’ department):
- Within one entity's parallel parents, alternatives are combined permissively (OR), e.g. a module belonging to two degrees satisfies either degree's restriction set of the same type.
- Across the module tree and the class tree, restrictions are combined strictly (AND).
- Inherited restrictions are shown read-only in the GUI; they can only be changed on the entity that defines them.