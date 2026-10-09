-- Room availability: recurring weekly time windows per room, optionally
-- scoped to a specific semester week (docs target model ROOM_AVAILABILITY).
-- NULL week_id = applies to every week of the semester.
CREATE TABLE IF NOT EXISTS room_availability (
  id VARCHAR(255) PRIMARY KEY,
  room_id VARCHAR(255) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  week_id VARCHAR(255) REFERENCES weeks(id) ON DELETE CASCADE,
  weekday VARCHAR(16) NOT NULL CHECK (weekday IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ck_room_availability_time CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_room_availability_room ON room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_week ON room_availability(week_id);