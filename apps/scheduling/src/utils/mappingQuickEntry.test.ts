import { describe, expect, it } from 'vitest'
import { buildCopyPairDiff, matchLecturerNames, matchModuleCodes } from './mappingQuickEntry'

const modules = [
  { id: 'm-1', code: 'MKT101', name: 'Marketing Basics' },
  { id: 'm-2', code: 'FIN102', name: 'Finance' },
]
const lecturers = [
  { id: 'l-1', name: 'Ada Lovelace' },
  { id: 'l-2', name: 'Tomás Stalder' },
]

describe('matchModuleCodes', () => {
  it('matches by code or name, case-insensitive', () => {
    const out = matchModuleCodes(['mkt101', 'finance'], modules)
    expect(out.matched.map(m => m.id)).toEqual(['m-1', 'm-2'])
    expect(out.unknown).toEqual([])
  })

  it('reports unknown entries as raw strings', () => {
    const out = matchModuleCodes(['MKT101', ' nope '], modules)
    expect(out.unknown).toEqual([' nope '])
  })

  it('handles empty entries', () => {
    expect(matchModuleCodes([], modules)).toEqual({ matched: [], unknown: [] })
  })

  it('tolerates umlauted names', () => {
    const out = matchModuleCodes(['Ökonomie'], [{ id: 'm-9', code: 'OEK', name: 'Ökonomie' }])
    expect(out.matched.map(m => m.id)).toEqual(['m-9'])
  })
})

describe('matchLecturerNames', () => {
  it('matches names case-insensitively and keeps raw values', () => {
    const out = matchLecturerNames(['ada lovelace', 'TOMÁS STALDER', ], lecturers)
    expect(out.matched.map(m => m.id)).toEqual(['l-1', 'l-2'])
    expect(out.matched[1]!.raw).toBe('TOMÁS STALDER')
  })

  it('reports unknown names', () => {
    expect(matchLecturerNames(['Nobody'], lecturers).unknown).toEqual(['Nobody'])
  })
})

describe('buildCopyPairDiff', () => {
  const opts = {
    mode: () => 'lecturer' as const,
    targetId: () => 'l-target',
    byLecturer: () => new Map([
      ['l-target', ['m-1']],
      ['l-source', ['m-1', 'm-2', 'm-3']],
    ]),
    byModule: () => new Map(),
  }

  it('adds all source pairs and removes target-only pairs', () => {
    const diff = buildCopyPairDiff({ ...opts, sourceId: () => 'l-source' })
    // replace semantics: all source pairs are (re-)sent; only target pairs
    // that the source lacks are removed — target's m-1 overlaps the source.
    expect(diff).toEqual([
      { lecturerId: 'l-target', moduleId: 'm-1', value: 1 },
      { lecturerId: 'l-target', moduleId: 'm-2', value: 1 },
      { lecturerId: 'l-target', moduleId: 'm-3', value: 1 },
    ])
  })

  it('produces an empty diff when target already mirrors the source', () => {
    const byLecturer = new Map([['l-target', ['m-1', 'm-2', 'm-3']], ['l-source', ['m-1', 'm-2', 'm-3']]])
    const diff = buildCopyPairDiff({ ...opts, byLecturer: () => byLecturer, sourceId: () => 'l-source' })
    // identical sets produce pure re-adds (no removals), not an empty diff
    expect(diff).toEqual([
      { lecturerId: 'l-target', moduleId: 'm-1', value: 1 },
      { lecturerId: 'l-target', moduleId: 'm-2', value: 1 },
      { lecturerId: 'l-target', moduleId: 'm-3', value: 1 },
    ])
  })

  it('returns [] without a target or source', () => {
    expect(buildCopyPairDiff({ ...opts, targetId: () => '', sourceId: () => 'l-source' })).toEqual([])
    expect(buildCopyPairDiff({ ...opts, sourceId: () => null })).toEqual([])
  })

  it('works module-centric (mode=module)', () => {
    const diff = buildCopyPairDiff({
      mode: () => 'module',
      targetId: () => 'mod-x',
      sourceId: () => 'mod-y',
      byLecturer: () => new Map(),
      byModule: () => new Map([
        ['mod-x', ['l-1']],
        ['mod-y', ['l-1', 'l-2']],
      ]),
    })
    expect(diff).toEqual([
      { lecturerId: 'l-1', moduleId: 'mod-x', value: 1 },
      { lecturerId: 'l-2', moduleId: 'mod-x', value: 1 },
    ])
  })
})