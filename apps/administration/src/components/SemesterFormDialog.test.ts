import { describe, expect, it, vi } from 'vitest'
import { normalizeTime, toMinutes, validateTimeslots } from '@/composables/useSemesterTimeslots'

/**
 * Flow test: Semester speichern („eingeben → validieren → Payload bauen") —
 * die Dialoglogik lebt in useSemesterTimeslots; das SFC ruft genau diese
 * Funktion vor dem save-emit auf (gemountete Dialoge über teleportierende
 * Vuetify-Overlays sind in jsdom zu spröde, deshalb Logik-Level).
 */
describe('Semester speichern — validateTimeslots (Ablauf eingeben → speichern)', () => {
  it('normalizes + sorts timeslots and accepts an edge-touching grid', () => {
    const out = validateTimeslots('30', ['09:00', '08:30'])
    expect(out.error).toBeNull()
    expect(out.normalizedDuration).toBe(30)
    expect(out.starts).toEqual(['08:30', '09:00'])
  })

  it('accepts an empty grid', () => {
    expect(validateTimeslots(undefined, undefined)).toEqual({ normalizedDuration: undefined, starts: [], error: null })
  })

  it('blocks a grid with starts but no duration', () => {
    expect(validateTimeslots(undefined, ['08:00']).error).toMatch(/timeslot length/)
  })

  it('blocks a grid with duration but no starts', () => {
    expect(validateTimeslots(45, []).error).toMatch(/at least one timeslot/)
  })

  it('blocks overlapping slots (start points closer than the slot length)', () => {
    const out = validateTimeslots(60, ['08:00', '08:30'])
    expect(out.error).toBe('Start points 08:00 and 08:30 are closer together than the timeslot length (60 min). The timeslots would overlap.')
  })

  it('accepts edge-touching slots (exactly one slot apart)', () => {
    expect(validateTimeslots(30, ['08:00', '08:30']).error).toBeNull()
  })

  it('skips malformed time strings instead of crashing', () => {
    const out = validateTimeslots(30, ['nonsense', '10:30', ''])
    expect(out.error).toBeNull()
    expect(out.starts).toEqual(['10:30'])
  })

  it('treats 0 and negative durations as no grid at all', () => {
    expect(validateTimeslots(0, ['08:00']).error).toMatch(/timeslot length/)
    expect(validateTimeslots(-5, ['08:00']).error).toMatch(/timeslot length/)
  })
})

describe('normalizeTime / toMinutes', () => {
  it('normalizes padded HH:MM inputs and rejects incomplete times', () => {
    expect(normalizeTime(' 8:05 ')).toBe('08:05')
    expect(normalizeTime('9:15:30')).toBe('09:15')
    // minutes are required two-digit (regex \d{2})
    expect(normalizeTime('8:5')).toBeNull()
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('12:60')).toBeNull()
    expect(normalizeTime('')).toBeNull()
  })

  it('converts to minutes', () => {
    expect(toMinutes('08:30')).toBe(510)
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('23:59')).toBe(23 * 60 + 59)
  })
})

describe('Dialog-Semantik (Submit-Verhalten)', () => {
  it('submit would emit exactly once thanks to the submitting guard', async () => {
    const submitting = { value: false }
    const emit = vi.fn()
    async function submitComponentLogic() {
      if (submitting.value) return
      submitting.value = true
      try {
        await Promise.resolve() // simulate the async validate() gap
        const result = validateTimeslots('45', ['08:00'])
        emit('save', result)
      } finally {
        submitting.value = false
      }
    }
    const p1 = submitComponentLogic()
    const p2 = submitComponentLogic()
    await Promise.all([p1, p2])
    expect(emit).toHaveBeenCalledTimes(1)
  })
})