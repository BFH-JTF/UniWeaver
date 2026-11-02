import { describe, expect, it } from 'vitest'
import { normalizeDegree, normalizeModule, normalizeProgram, normalizeRoom } from './curriculumNormalize'

describe('curriculumNormalize', () => {
  it('normalizeProgram resolves legacy department ids in both spellings', () => {
    const legacy = { name: 'P', departmentIds: ['d1'] }
    const out = normalizeProgram(legacy as never)
    expect(out.departmentIDs).toEqual(['d1'])
    expect(out.departmentIds).toEqual(['d1'])
  })

  it('normalizeDegree resolves ids in fixed priority: ProgramIDs > programIDs > programIds', () => {
    expect(normalizeDegree({ name: 'D', ProgramIDs: ['a'], programIDs: ['b'], programIds: ['c'] } as never).ProgramIDs).toEqual(['a'])
    expect(normalizeDegree({ name: 'D', programIDs: ['b'], programIds: ['c'] } as never).programIDs).toEqual(['b'])
    expect(normalizeDegree({ name: 'D', programIds: ['c'] } as never).ProgramIDs).toEqual(['c'])
  })

  it('normalizeModule falls back from DegreeIDs to degreeIds in fixed priority', () => {
    expect(normalizeModule({ name: 'M', DegreeIDs: ['deg-1'] } as never).degreeIds).toEqual(['deg-1'])
    expect(normalizeModule({ name: 'M', degreeIds: ['deg-2'] } as never).DegreeIDs).toEqual(['deg-2'])
    expect(normalizeModule({ name: 'M', DegreeIDs: ['x'], degreeIds: ['y'] } as never).degreeIds).toEqual(['x'])
  })

  it('normalizeRoom migrates legacy snake_case rows and flattens capacity objects', () => {
    const out = normalizeRoom({ name: 'E102', room_type: 'classroom', room_number: 'E102', capacity: { seats: 55 }, location_id: 'loc-1' })
    expect(out.roomType).toBe('classroom')
    expect(out.roomNumber).toBe('E102')
    expect(out.capacity).toBe(55)
    expect(out.locationId).toBe('loc-1')
    expect(((out as unknown as Record<string, unknown>)).room_type).toBeUndefined()
  })

  it('normalizeRoom keeps camelCase values, defaults roomType and zero capacity, drops availability', () => {
    const out = normalizeRoom({ name: 'R', roomType: 'lecture_hall', capacity: { seats: 0 }, availability: {} })
    expect(out.roomType).toBe('lecture_hall')
    expect(out.capacity).toBe(0)
    expect(((out as unknown as Record<string, unknown>)).availability).toBeUndefined()
  })

  it('normalizeRoom never crashes on garbage rows', () => {
    expect(normalizeRoom({})).toMatchObject({ capacity: 0, roomNumber: '' })
    expect(normalizeRoom({ capacity: 'x', roomNumber: 5 })).toMatchObject({ capacity: 0 })
  })
})