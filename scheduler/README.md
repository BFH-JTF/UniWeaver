# UniWeaver Scheduling Service

A Timefold-backed timetabling microservice. It does one job: given rooms,
lecturers, candidate timeslots, and a list of sessions that need to happen,
find a room + timeslot + lecturer for each session that satisfies all hard
constraints and optimizes the soft ones. Everything else about UniWeaver
(curriculum, competencies, users, auth) stays in your TypeScript app - this
service only sees what it needs to solve the scheduling problem.

## Why the data model looks different from your ERD

`SCHEDULE_ENTRY` stores *arrays* of `moduleIds` / `roomIds` / `classIds` /
`lecturerIds`, because one calendar slot can legitimately bundle several of
each (e.g. a joint lecture spanning two classes). A constraint solver wants
one atomic decision per entity, not a decision over a set of IDs. So instead
of mirroring `SCHEDULE_ENTRY` directly, the planning entity here is a
**`SessionAssignment`**: one occurrence of one module-unit for one class.

Your app generates `MODULE.unitsPerWeek` of these per module+class pairing
before calling this service. After solving, fold any `SessionAssignment`s
that land on the same room + timeslot + lecturer back into a single
`SCHEDULE_ENTRY` row (or just store each as its own `SCHEDULE_ENTRY` with
single-element arrays - whichever matches how "joint sessions" should work
in your app).

Curriculum-only entities (`DEGREE`, `COMPETENCY`, `PROOF_OF_COMPETENCY`,
`TAXONOMY_ITEM`, `COMPETENCY_MATRIX`, ...) don't appear here at all - the
solver never needs them.

## Design decisions worth knowing about

- **Lecturer qualification** (`MODULE }o--o{ LECTURER`) is enforced by
  restricting each `SessionAssignment`'s lecturer *value range* to its
  qualified pool (`getLecturerCandidates()`), not by a penalty constraint.
  The solver physically cannot pick an unqualified lecturer - it never
  wastes search time exploring that option.
- **Room/lecturer availability semantics**: `AvailabilityWindow` is treated
  as an allow-list ("available during this window"), and an empty list means
  "available always". UniWeaver's backend performs the blackout-to-allowlist
  conversion when assembling the request (rooms: availability windows as
  declared; lecturers: unavailability blocks flipped into allowed windows).
- **`SCHEDULING_RULE` is open-ended by design** in your ERD (external
  catalog, arbitrary `ruleType` + `params`), so this service can't
  auto-generate a constraint per rule type. One example is wired up
  (`minGapBetweenUnits` in `ScheduleConstraintProvider`) showing how to turn
  a `SchedulingRule` row into a live, weighted constraint. Copy that pattern
  for the rest of your rule catalog as you need it.
- **`minWeeksBetweenUnits` / `maxWeeksBetweenUnits`** (on `MODULE`) aren't
  wired up yet - they need per-session week numbers compared pairwise,
  which is a natural extension of the `schedulingRuleMinGapBetweenUnits`
  pattern once you decide how you want that expressed as data.

## Project layout

```
src/main/java/org/uniweaver/scheduling/
  UniWeaverSchedulingApplication.java     entry point
  domain/                                  Timefold facts + planning entities + solution
    TimeSlot.java
    AvailabilityWindow.java
    Room.java
    Lecturer.java
    SchedulingRule.java
    SessionAssignment.java                 <- the planning entity
    Schedule.java                          <- the planning solution
  solver/
    ScheduleConstraintProvider.java        <- all hard/soft constraints live here
  rest/
    ScheduleResource.java                  <- POST/GET/DELETE /api/schedules
    ScheduleMapper.java                    <- DTO <-> domain conversion
    dto/
      ScheduleRequest.java
      ScheduleResponse.java
typescript/
  scheduling-api.ts                        <- matching TS types + fetch client
```

## Running it

Requires JDK 17+ and Maven 3.9+.

```bash
mvn spring-boot:run
```

The service listens on `:8081`. Solve requests run in the background; poll
for results (see `application.yml` for the default 30s termination limit -
raise this for real semester-sized problems).

The termination limit can also be controlled per request: the UniWeaver
backend sends `termination.spentLimitSeconds` in the `ScheduleRequest`
extension fields and this service honors it when present (30s fallback).

## Example request

```bash
curl -X POST http://localhost:8081/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "semesterId": "sem-2026-fall",
    "rooms": [
      { "id": "room-1", "name": "A101", "roomType": "lecture", "capacity": 40 }
    ],
    "lecturers": [
      { "id": "lect-1", "name": "Dr. Muller" }
    ],
    "timeSlots": [
      { "id": "ts-1", "weekId": "week-1", "dayOfWeek": "MONDAY", "startTime": "09:00:00", "endTime": "10:30:00" },
      { "id": "ts-2", "weekId": "week-1", "dayOfWeek": "MONDAY", "startTime": "10:30:00", "endTime": "12:00:00" }
    ],
    "sessions": [
      {
        "id": "sess-1",
        "moduleId": "mod-1",
        "moduleName": "Algorithms",
        "classId": "class-1",
        "className": "CS-2026-A",
        "studentCount": 30,
        "durationMinutes": 90,
        "sequenceIndex": 1,
        "lecturerCandidateIds": ["lect-1"]
      }
    ]
  }'
```

This returns `202 Accepted` with a `jobId`. Poll
`GET /api/schedules/{jobId}` until `solverStatus` is `NOT_SOLVING`; at that
point `score.feasible` tells you whether every hard constraint was
satisfied, and each entry in `sessions[]` carries its assigned
`roomId`/`timeSlotId`/`lecturerId`.

## From the TypeScript side

```ts
import { SchedulingClient } from "./scheduling-api";

const client = new SchedulingClient("http://localhost:8081");
const result = await client.solveAndWait(request);
if (!result.score.feasible) {
  // hard constraints couldn't all be satisfied - inspect result.score.hardScore
}
```

## Next steps you'll likely want

- Swap the in-memory `jobIdToSchedule` map in `ScheduleResource` for a real
  store once more than one instance of this service can run.
- Add `springdoc-openapi` if you want the TS types generated instead of
  hand-maintained.
- Extend `ScheduleConstraintProvider` per `SchedulingRule.ruleType` as your
  rule catalog grows.
