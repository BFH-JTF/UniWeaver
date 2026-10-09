-- Schedule runs + entries: storage for generated semester schedules.
--
-- A "run" is one execution of the Timefold scheduling service for one
-- semester. Its entries follow the documented SCHEDULE_ENTRY contract
-- (docs/data_model.md): calendar slot + jsonb id arrays, because one slot
-- can legitimately bundle several modules/classes/rooms/lecturers.
--
-- week_id NULL means the recurring weekly pattern (the run was generated
-- against the representative weekly timeslot grid, not concrete calendar
-- weeks). Concrete per-week placements (with per-week exceptions like
-- days-off) are a planned follow-up.

CREATE TABLE IF NOT EXISTS schedule_runs (
  id VARCHAR(255) PRIMARY KEY,
  semester_id VARCHAR(255) NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  -- pending: created, solver call queued
  -- generating: solver running
  -- draft: solver finished, entries stored, not yet published
  -- published: marked as the semester's active schedule
  -- failed: assembly or solver error (error message in stats.error)
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'draft', 'published', 'failed')),
  -- { hardScore, softScore, feasible } from the solver (empty until finished)
  score JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { sessionsTotal, sessionsPlaced, sessionsUnplaced, unplaced: [...],
  --   classes, modules, rooms, lecturers, warnings: [...], error? }
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { spentLimitSeconds } - the termination limit the user chose
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255) REFERENCES local_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_semester ON schedule_runs(semester_id);

CREATE TABLE IF NOT EXISTS schedule_entries (
  id VARCHAR(255) PRIMARY KEY,
  run_id VARCHAR(255) NOT NULL REFERENCES schedule_runs(id) ON DELETE CASCADE,
  -- NULL = applies to every week of the semester (recurring pattern)
  week_id VARCHAR(255) REFERENCES weeks(id) ON DELETE CASCADE,
  weekday VARCHAR(16) NOT NULL
    CHECK (weekday IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  module_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  room_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  class_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  lecturer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_entries_run ON schedule_entries(run_id);