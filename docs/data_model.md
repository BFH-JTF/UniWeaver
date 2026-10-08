# Main Data Model
The data model consists of three interconnected parts:
1. Administrative structure
2. Scheduling
3. Competency Mapping

All objects within this data structure need versioning. Even static data objects like departments or semesters need versioning, since the contraints added to them can change over time.

```mermaid
erDiagram

    %% ── Curriculum structure ─────────────────────────────────
    CURRICULUM ||--o{ CURRICULUM_VERSION : "has versions"
    CURRICULUM ||--o| CURRICULUM_VERSION : "active version"
    PROGRAM }o--o| CURRICULUM : "assigned to"

    DEPARTMENT }|--o{ PROGRAM : "offers"
    DEPARTMENT ||--o{ LECTURER : "employs"
    PROGRAM }|--o{ DEGREE : "offers"
    %% kept (7.1, intentional data): degreeIds = degrees the module is part of
    DEGREE }|--|{ MODULE : "contains"

    CURRICULUM_VERSION ||--o{ MODULE : "defines"
    CURRICULUM_VERSION ||--o{ CLASS_ENTITY : "followed by"

    DEGREE ||--o{ CLASS_ENTITY : "pursued by"
    SEMESTER ||--o{ CLASS_ENTITY : "hosts"

    MODULE }o--o{ CLASS_ENTITY : "taken by"
    %% module-level link via the MODULE_LECTURERS join table (resolved per
    %% term/responsibility); SCHEDULE_ENTRY.lecturerIds = actually teaching
    %% that session (7.2, planned)
    MODULE }o--o{ LECTURER : "taught by"
    MODULE ||--o{ LESSON : "contains"

    LESSON }o--o{ TAXONOMY_ITEM : "categorized by"
    LESSON }o--o{ PROOF_OF_COMPETENCY : "assessed by"

    MODULE }o--|{ COMPETENCY : "develops"
    MODULE }o--o{ PROOF_OF_COMPETENCY : "assessed by"
    %% invariant (7.3): competencies evaluated by a module's proofs
    %% must appear in that module's competencyIds
    PROOF_OF_COMPETENCY }o--|{ COMPETENCY : "evaluates"

    COMPETENCY_MATRIX ||--|{ MATRIX_COMPETENCY : "defines"
    COMPETENCY }o--o| MATRIX_COMPETENCY : "x-axis mapped"
    COMPETENCY }o--o| MATRIX_COMPETENCY : "y-axis mapped"

    %% ── Resources & calendar ─────────────────────────────────
    LOCATION ||--o{ ROOM : "contains"

    %% rooms with week_id NULL are available every week of the semester
    ROOM ||--o{ ROOM_AVAILABILITY : "has"
    %% inverted semantics: lecturers declare when they are NOT available
    LECTURER ||--o{ LECTURER_UNAVAILABILITY : "has"
    USER |o--o| LECTURER : "is"

    SEMESTER ||--o{ SCHEDULING_RULE : "has"
    SEMESTER ||--o{ WEEK : "contains"

    WEEK ||o--o| ROOM_AVAILABILITY : "scopes"
    WEEK ||o--o| SCHEDULE_ENTRY : "contains"

    %% ── Scheduling: M:N via FK arrays on SCHEDULE_ENTRY ──────
    ROOM }o--o{ SCHEDULE_ENTRY : "hosts"
    MODULE }o--o{ SCHEDULE_ENTRY : "scheduled in"
    CLASS_ENTITY }o--o{ SCHEDULE_ENTRY : "participates in"
    LECTURER }o--o{ SCHEDULE_ENTRY : "teaches"

    %% explicit join table stored in the database
    LECTURER ||--o{ MODULE_LECTURERS : "mapped to"
    MODULE ||--o{ MODULE_LECTURERS : "mapped from"

    %% ── Implicit, derived links (no stored FK) ───────────────
    %% An availability window or rule informs an entry when the
    %% room/lecturer matches and the window covers the entry's
    %% weekday + time window.
    ROOM_AVAILABILITY }o--o{ SCHEDULE_ENTRY : "informs"
    LECTURER_UNAVAILABILITY }o--o{ SCHEDULE_ENTRY : "constrains"
    SCHEDULING_RULE }o--o{ SCHEDULE_ENTRY : "informs"

    %% supplierId = external identity provider/tenant; localName = login handle
    USER {
        string id PK
        string localName
        string displayName
        string email
        string supplierId
        array roles
        boolean isAdmin
        boolean isUserAdmin
        boolean isScheduler
        boolean isNotLecturer
        boolean isActive
        string timezone
        datetime createdAt
    }

    %% name kept for guest lecturers without USER accounts
    LECTURER {
        string id PK
        string name
        string userId FK
        string departmentId FK
        array moduleIds FK
    }

    DEPARTMENT {
        string id PK
        string name
        string description
        string contact
        string url
    }

    PROGRAM {
        string id PK
        string name
        string description
        array departmentIds FK
        string curriculumId FK
        string contact
        string url
    }

    DEGREE {
        string id PK
        string name
        string description
        array programIds FK
        string contact
        string url
    }

    CURRICULUM {
        string id PK
        string name
        string description
        string activeVersionId FK
        datetime createdAt
    }

    CURRICULUM_VERSION {
        string id PK
        string name
        string description
        number versionNumber
        string curriculumId FK
        string semesterId FK
        string createdBy FK
        datetime createdAt
    }

    %% selfStudyHours and contactHours dropped; module duration is expressed
    %% in semester timeslots (timeslots = n × semester slot length)
    MODULE {
        string id PK
        string name
        string code
        string description
        array degreeIds FK
        string curriculumVersionId FK
        array competencyIds FK
        array proofOfCompetencyIds FK
        number creditPoints
        number timeslots
        string contact
        string url
    }

    %% curriculumVersionId determines the program; degreeId must be offered
    %% by that program; semesterId = intake semester (startingYear dropped)
    CLASS_ENTITY {
        string id PK
        string name
        string code
        string description
        string semesterId FK
        string curriculumVersionId FK
        string degreeId FK
        array moduleIds FK
        number size
        string contact
        string url
    }

    LESSON {
        string id PK
        string moduleId FK
        string name
        string description
        array taxonomyItemIds FK
        array proofOfCompetencyIds FK
    }

    TAXONOMY_ITEM {
        string id PK
        string name
        string description
    }

    %% xMatrixCompetencyId → row with matrixAxis 'x', yMatrixCompetencyId →
    %% row with matrixAxis 'y' (so the two FKs can never reference the same
    %% row); matrixDefined dropped — derivable from the FKs
    COMPETENCY {
        string id PK
        string name
        string category
        string topic
        string description
        string level
        string xMatrixCompetencyId FK
        string yMatrixCompetencyId FK
    }

    COMPETENCY_MATRIX {
        string id PK
        string name
        string description
    }

    %% matrixAxis ('x' | 'y') is the defining attribute of a grid row;
    %% the grid renders even when no COMPETENCY is mapped to it
    MATRIX_COMPETENCY {
        string id PK
        string competencyMatrixId FK
        string name
        string category
        string description
        string level
        string matrixAxis
    }

    %% answerFormats replaces assessmentType/multipleChoice/freeText;
    %% a proof may mix formats, e.g. ["multipleChoice", "freeText"]
    PROOF_OF_COMPETENCY {
        string id PK
        string name
        string description
        array answerFormats
        string assignmentScope
        number durationMinutes
        array competencyIds FK
    }

    LOCATION {
        string id PK
        string name
        string campus
        string building
        string address
        number latitude
        number longitude
    }

    ROOM {
        string id PK
        string name
        string roomType
        string owner
        string locationId FK
        string floor
        string roomNumber
        number capacity
        json layout
        json equipment
        json connectivity
        json accessibility
        json maintenance
    }

    %% inverted semantics versus availability, see migration 014
    LECTURER_UNAVAILABILITY {
        string id PK
        string lecturerId FK
        string kind
        string weekday
        date date
        time startTime
        time endTime
        string note
    }

    %% explicit join table; one row per lecturer-module pair
    MODULE_LECTURERS {
        string lecturerId PK, FK
        string moduleId PK, FK
        string createdBy
    }

    %% week_id nullable: NULL = applies to every week of the semester
    ROOM_AVAILABILITY {
        string id PK
        string roomId FK
        string weekId FK
        string weekday
        time startTime
        time endTime
    }

    %% slotDurationMinutes + slotStartTimes define the daily timeslot grid;
    %% module sessions may only start at these boundaries
    SEMESTER {
        string id PK
        string name
        string code
        date startDate
        date endDate
        number slotDurationMinutes
        array slotStartTimes
    }

    %% daysOff: array of dates
    WEEK {
        string id PK
        string semesterId FK
        number semesterWeek
        date startDate
        date endDate
        array daysOff
    }

    %% ruleType → external constraint catalog; appliesTo = entity ids
    %% (modules, rooms, lecturers, classes) the rule scopes to;
    %% weight = priority 1 (nice-to-have) … 5 (mandatory condition)
    SCHEDULING_RULE {
        string id PK
        string ruleType
        number weight
        boolean enabled
        string description
        string semesterId FK
        json params
        array appliesTo
    }
```

# Solver API

The semester schedule generation is **not implemented yet**. What exists is the input
contract: `packages/shared/src/restrictionSolver.ts` assembles a schedule request for the
future solver by merging the effective restrictions of all involved entities
(`buildSchedulingRulesForPairing()`, `mergeParams()`) into solver-facing rule DTOs
(`SchedulingRuleDTO`).

For each module/class pairing, the entity restrictions (see
[restrictions.md](restrictions.md)) are merged and mapped onto the solver's rule types:

- Within one entity's parallel parents, same-type restrictions are combined permissively
  (OR) — the most permissive parameter set wins.
- Across the module tree and the class tree, restriction sets are combined strictly (AND).
- Weight stays 1–5; level-5 rules are hard constraints, levels 1–4 are preferences.

The solver itself (algorithm and API endpoint) is future work.