/** Normalizes a time input to HH:MM; returns null when empty/invalid. */
export function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value?.trim() ?? '')
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Minutes since midnight for a HH:MM string. */
export function toMinutes(time: string): number {
  const parts = time.split(':')
  const h = Number(parts[0] ?? 0)
  const m = Number(parts[1] ?? 0)
  return h * 60 + m
}

export interface TimeslotValidation {
  normalizedDuration: number | undefined
  starts: string[]
  /** Blocking error message, or null when the timeslot grid is valid. */
  error: string | null
}

/**
 * Validates + normalizes the semester timeslot grid: HH:MM inputs are
 * normalized and sorted, an incomplete grid (duration without starts or vice
 * versa) is rejected, and overlapping slots (consecutive starts closer than
 * the slot length) are refused. Pure logic, UI-less — used by the semester
 * dialog before it emits its save payload.
 */
export function validateTimeslots(
  duration: number | null | undefined | string,
  rawStarts: unknown[] | undefined,
): TimeslotValidation {
  const normalizedDuration =
    duration === undefined || duration === null || (duration as unknown) === '' ? undefined : Number(duration)

  const starts = (rawStarts ?? [])
    .map(t => normalizeTime(String(t)))
    .filter((t): t is string => t !== null)
  starts.sort()

  // Structural validation (blocking): duration required, at least one start
  if ((normalizedDuration === undefined || normalizedDuration === null || normalizedDuration <= 0) && starts.length > 0) {
    return { normalizedDuration, starts, error: 'Please define the timeslot length in minutes.' }
  }
  if (normalizedDuration !== undefined && normalizedDuration !== null && normalizedDuration > 0 && starts.length === 0) {
    return { normalizedDuration, starts, error: 'Please add at least one timeslot start point.' }
  }

  // Reject overlapping slots: consecutive starts must be at least one slot apart
  if (normalizedDuration !== undefined && normalizedDuration !== null && normalizedDuration > 0) {
    const minGap = Number(normalizedDuration)
    for (let i = 1; i < starts.length; i++) {
      const prev = starts[i - 1]
      const curr = starts[i]
      if (!prev || !curr) continue
      if (toMinutes(curr) - toMinutes(prev) < minGap) {
        return {
          normalizedDuration,
          starts,
          error: `Start points ${prev} and ${curr} are closer together than the timeslot length (${minGap} min). The timeslots would overlap.`,
        }
      }
    }
  }

  return { normalizedDuration, starts, error: null }
}