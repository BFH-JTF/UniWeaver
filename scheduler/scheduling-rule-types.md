# Scheduling Rule Types

Comprehensive reference of all possible `SchedulingRule.ruleType` values for the uniweaver scheduling solver. Each rule type is implemented as a constraint method in `ScheduleConstraintProvider`. Rules can be enabled/disabled and weighted via the `SchedulingRule` object (fields: `enabled`, `weight`, `params`, `appliesTo`).

---

## Hard Constraints

*Violations make a solution infeasible regardless of soft score.*

### Room-related

#### `roomCapacity`
Room must fit the class's student count. Penalty scales with how far over capacity the room is. *(implemented)*

#### `roomTypeMatch`
Room type must match the session type. A lecture cannot be assigned to a lab room and vice versa. Prevents physically impossible room assignments.

#### `roomEquipmentRequired`
Room must have specific equipment required by the session (e.g., projector, whiteboard, lab bench). Configurable via `params` with an `equipment` list.

#### `roomAvailability`
Room can only host a session inside one of its declared availability windows. *(implemented)*

### Lecturer-related

#### `lecturerAvailability`
A lecturer can only teach during one of their declared availability windows. *(implemented)*

#### `lecturerQualification`
Lecturer must be qualified to teach the module. Currently enforced via per-entity value range (the solver physically cannot pick an unqualified lecturer); this rule provides a secondary enforcement layer if qualification data changes mid-solve.

#### `maxLecturesPerDay`
A lecturer can't teach more than N sessions in a single day. Configurable via `params` with a `maxPerDay` integer.

#### `minRestBetweenLectures`
Minimum break required between consecutive sessions for the same lecturer. Configurable via `params` with a `minMinutes` integer. Prevents burnout and unrealistic back-to-back scheduling.

### Student/Class-related

#### `classConflict`
A class can't attend two sessions at overlapping times. *(implemented)*

#### `maxStudentsPerRoom`
Room capacity must not be exceeded by the total student count across all sessions assigned to it in a given time slot. Handles the case where multiple small sessions share a room simultaneously.

#### `noOverlapWithOtherClasses`
A class can't have sessions in two different rooms at the same time. Reinforces `classConflict` but catches cross-room collisions explicitly.

### Time-related

#### `timeSlotDuration`
Session duration must match the time slot length. A 90-minute session cannot be placed in a 60-minute slot.

#### `maxSessionsPerDay`
A class can't have more than N sessions in a single day. Configurable via `params` with a `maxPerDay` integer.

#### `noSessionsOnDay`
No sessions allowed for certain classes on specific days of the week. Configurable via `params` with a `days` list (e.g., `["FRIDAY"]`).

---

## Soft Constraints

*Violations are penalized but don't make a solution infeasible. Lower weight = easier to relax.*

### Lecturer preferences

#### `lecturerRoomStability`
Prefer a lecturer to teach all their sessions in the same room. Reduces to-and-fro movement. *(implemented)*

#### `lecturerPreferredTimes`
Prefer certain time slots for a lecturer (e.g., mornings). Configurable via `params` with `preferredStartTimes` or `preferredDays`. Penalty applied when a lecturer is assigned outside preferred times.

#### `lecturerPreferredDays`
Prefer certain days of the week for a lecturer. Configurable via `params` with a `preferredDays` list.

#### `noBackToBackLectures`
Prefer a gap between consecutive sessions for the same lecturer. Prevents exhausting back-to-back teaching blocks.

#### `minimizeLecturerTravel`
Prefer consecutive sessions for the same lecturer to be in nearby rooms. Requires a distance matrix or room grouping in `params`.

#### `lecturerWorkloadBalance`
Distribute lecturer workload evenly across the semester. Penalizes lecturers who have heavily loaded weeks compared to others.

### Student/class preferences

#### `maxGapBetweenUnits`
Limit gaps between sessions of the same module on the same day. Prevents long idle periods for students. *(partially implemented as `schedulingRuleMinGapBetweenUnits`)*

#### `maxUnitsPerDay`
Limit the number of distinct modules a class has sessions for in a single day. Configurable via `params` with a `maxUnits` integer.

#### `preferredSessionOrder`
Sessions of a module should follow a preferred sequence (e.g., theory before lab). Penalizes out-of-order assignments based on `sequenceIndex`.

#### `noEarlyMorningClasses`
Prefer no classes before a certain time (e.g., 9:00 AM). Configurable via `params` with an `earliestTime`.

#### `preferredDayForModule`
Certain modules are preferred on certain days of the week. Configurable via `params` with a `preferredDay` field.

### Room utilization

#### `roomUtilization`
Prefer rooms to be used efficiently — small classes shouldn't fill large rooms. Penalty based on the ratio of student count to room capacity.

#### `roomTypePreference`
Prefer specific room types for certain session types (e.g., lectures in lecture halls, seminars in seminar rooms). Less strict than `roomTypeMatch` — allows over-ride at a soft penalty.

#### `minimizeRoomChanges`
Prefer a class to use the same room across multiple sessions. Reduces room turnover and logistical complexity.

### Curriculum / sequencing

#### `minWeeksBetweenUnits`
Enforce a minimum gap in weeks between units of the same module. Configurable via `params` with a `minWeeks` integer. *(listed as future extension in README)*

#### `maxWeeksBetweenUnits`
Enforce a maximum gap in weeks between units of the same module. Prevents sessions from being spread too thinly across the semester. Configurable via `params` with a `maxWeeks` integer.

#### `sessionOrdering`
Sessions of a module must follow a strict order (e.g., Session 1 must be before Session 2). Enforces prerequisite structure within a module's unit sequence.

#### `noSessionsDuringExamWeek`
No regular sessions allowed during exam periods. Configurable via `params` with `examWeekIds`.

#### `respectCurriculumBlocks`
Certain modules must be scheduled within specific curriculum blocks or periods (e.g., Module A must be in weeks 1–8). Configurable via `params` with `blockStartWeek` and `blockEndWeek`.

### Administrative / organizational

#### `maxConsecutiveTeachingDays`
Limit consecutive teaching days for a lecturer. Configurable via `params` with a `maxConsecutiveDays` integer.

#### `noTeachingDuringAdminDays`
No sessions allowed on university admin/planning days. Configurable via `params` with a list of excluded dates or week IDs.

#### `respectHolidayPeriods`
No sessions during university holidays. Configurable via `params` with a list of holiday week IDs or date ranges.

#### `balanceWeeklyLoad`
Evenly distribute sessions across weeks of the semester. Penalizes weeks with unusually high or low session density compared to the average.

#### `groupSessionsTogether`
Prefer sessions of the same module to be scheduled close together in the timetable (adjacent days or consecutive weeks). Reduces context switching for students and lecturers.

#### `avoidWeekendSessions`
Prefer no sessions on weekends. Configurable via `params` — can be a hard constraint (no weekend sessions allowed) or soft (penalty for weekend assignments).

#### `peakHourAvoidance`
Avoid scheduling certain session types during peak campus hours (e.g., 10:00–12:00). Configurable via `params` with `peakStart` and `peakEnd` times.

---

## Cross-cutting / Advanced

### `jointSessionPlacement`
Joint sessions (multiple classes taught together) must be in a room large enough for the combined student count and have all required lecturers available simultaneously. Requires combining multiple `SessionAssignment`s into a single joint placement.

### `minDistanceBetweenRooms`
If two sessions share a class, prefer rooms that are physically close together to minimize walking time. Requires a room distance matrix in `params`.

### `avoidClashWithOtherModules`
Prevent students from having overlapping sessions across different modules. Requires student enrollment data mapped to modules.

### `parallelSessionLimit`
Limit how many sessions can run simultaneously across the entire university in a given time slot. Useful for managing building and resource capacity.

### `preferredStartTimes`
All sessions of a certain type should start at consistent times (e.g., all lectures start on the hour). Reduces schedule fragmentation and simplifies logistics.

---

## Implementation Notes

- **Existing rules**: `roomConflict`, `lecturerConflict`, `classConflict`, `roomCapacity`, `roomAvailability`, `lecturerAvailability`, `lecturerRoomStability`, `schedulingRuleMinGapBetweenUnits` are already implemented.
- **New rules**: Add a `private Constraint ruleName(ConstraintFactory factory)` method to `ScheduleConstraintProvider` and reference it in `defineConstraints()`.
- **Configuration**: Rule-specific parameters go in the `SchedulingRule.params` map (e.g., `{"maxPerDay": 4}`).
- **Scope**: Use `appliesTo` to limit which sessions/modules the rule applies to, or leave it empty for global application.
- **Weight**: The `weight` field on `SchedulingRule` determines the penalty magnitude for soft constraint violations.

---

## Rule Type Summary Table

| Category | Rule Type | Implemented? |
|---|---|---|
| **Hard** | `roomCapacity` | Yes |
| **Hard** | `roomTypeMatch` | No |
| **Hard** | `roomEquipmentRequired` | No |
| **Hard** | `roomAvailability` | Yes |
| **Hard** | `lecturerAvailability` | Yes |
| **Hard** | `lecturerQualification` | Via value range |
| **Hard** | `maxLecturesPerDay` | No |
| **Hard** | `minRestBetweenLectures` | No |
| **Hard** | `classConflict` | Yes |
| **Hard** | `maxStudentsPerRoom` | No |
| **Hard** | `noOverlapWithOtherClasses` | No |
| **Hard** | `timeSlotDuration` | No |
| **Hard** | `maxSessionsPerDay` | No |
| **Hard** | `noSessionsOnDay` | No |
| **Soft** | `lecturerRoomStability` | Yes |
| **Soft** | `lecturerPreferredTimes` | No |
| **Soft** | `lecturerPreferredDays` | No |
| **Soft** | `noBackToBackLectures` | No |
| **Soft** | `minimizeLecturerTravel` | No |
| **Soft** | `lecturerWorkloadBalance` | No |
| **Soft** | `maxGapBetweenUnits` | Partial |
| **Soft** | `maxUnitsPerDay` | No |
| **Soft** | `preferredSessionOrder` | No |
| **Soft** | `noEarlyMorningClasses` | No |
| **Soft** | `preferredDayForModule` | No |
| **Soft** | `roomUtilization` | No |
| **Soft** | `roomTypePreference` | No |
| **Soft** | `minimizeRoomChanges` | No |
| **Curriculum** | `minWeeksBetweenUnits` | No |
| **Curriculum** | `maxWeeksBetweenUnits` | No |
| **Curriculum** | `sessionOrdering` | No |
| **Curriculum** | `noSessionsDuringExamWeek` | No |
| **Curriculum** | `respectCurriculumBlocks` | No |
| **Admin** | `maxConsecutiveTeachingDays` | No |
| **Admin** | `noTeachingDuringAdminDays` | No |
| **Admin** | `respectHolidayPeriods` | No |
| **Admin** | `balanceWeeklyLoad` | No |
| **Admin** | `groupSessionsTogether` | No |
| **Admin** | `avoidWeekendSessions` | No |
| **Admin** | `peakHourAvoidance` | No |
| **Advanced** | `jointSessionPlacement` | No |
| **Advanced** | `minDistanceBetweenRooms` | No |
| **Advanced** | `avoidClashWithOtherModules` | No |
| **Advanced** | `parallelSessionLimit` | No |
| **Advanced** | `preferredStartTimes` | No |

**Total: 43 rule types** (8 implemented, 1 partial, 34 remaining to implement)
