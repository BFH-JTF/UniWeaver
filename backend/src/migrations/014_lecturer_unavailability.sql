-- Lecturer unavailability ("I am NOT available"): inverted semantics versus
-- room availability, because the semester's recurring timeslots already define
-- the possible teaching times. Two entry kinds:
--   weekly_recurring : every week on the given weekday (e.g. "no Fridays")
--   individual_date  : a concrete date, optionally restricted to a time window
CREATE TABLE IF NOT EXISTS lecturer_unavailability (
  id VARCHAR(255) PRIMARY KEY,
  lecturer_id VARCHAR(255) NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('weekly_recurring', 'individual_date')),
  weekday VARCHAR(16) CHECK (weekday IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  date DATE,
  start_time TIME,
  end_time TIME,
  note VARCHAR(255) DEFAULT '',
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ck_unavail_kind_fields CHECK (
    (kind = 'weekly_recurring' AND weekday IS NOT NULL AND date IS NULL)
    OR (kind = 'individual_date' AND date IS NOT NULL AND weekday IS NULL)
  ),
  CONSTRAINT ck_unavail_time CHECK (start_time IS NULL OR end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_lecturer_unavailability_lecturer ON lecturer_unavailability(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_unavailability_date ON lecturer_unavailability(date);