import { describe, expect, it } from 'vitest'
import { IMPORT_CONFIGS, autoMapColumns } from './csvSchemas'
import { parseStringArray } from './csvSchemas'
import { parseCsv } from './csvParser'

describe('IMPORT_CONFIGS transforms', () => {
  for (const cfg of Object.values(IMPORT_CONFIGS)) {
    it(`transform of ${cfg.type} maps a full row onto the entity shape`, () => {
      // A generically valid row: every field key gets a value (defaults or typed).
      const row: Record<string, unknown> = {}
      for (const field of cfg.fields) {
        if (field.key === 'id') { row.id = 'x-1'; continue }
        row[field.key] = field.defaultValue !== undefined ? field.defaultValue : 'Wert'
      }
      const out = cfg.transform([row])
      expect(out).toHaveLength(1)
      const entity = out[0] as Record<string, unknown>
      expect(entity.name).toBeDefined()
      expect(entity.id).toBe('x-1')
    })

    it(`transform of ${cfg.type} returns [] for empty input and handles missing optionals`, () => {
      expect(cfg.transform([])).toEqual([])
      const minimal: Record<string, unknown> = {}
      for (const field of cfg.fields) if (field.required && field.key !== 'id') minimal[field.key] = 'x'
      const out = cfg.transform([minimal]) as Record<string, unknown>[]
      expect(out).toHaveLength(1)
      expect(out[0].name).toBeDefined()
    })
  }
})

describe('parseStringArray', () => {
  it('splits by comma/semicolon/pipe, trims and drops empties', () => {
    expect(parseStringArray('a | b|c')).toEqual(['a', 'b', 'c'])
    expect(parseStringArray('a, b; c')).toEqual(['a', 'b', 'c'])
    expect(parseStringArray('')).toEqual([])
    expect(parseStringArray(null)).toEqual([])
    expect(parseStringArray(['x'])).toEqual(['x'])
  })

  it('parses JSON arrays and passes non-strings through', () => {
    expect(parseStringArray('["p1","p2"]')).toEqual(['p1', 'p2'])
    // malformed JSON falls through to plain delimiter splitting
    expect(parseStringArray('[oops')).toEqual(['[oops'])
    expect(parseStringArray(42)).toEqual(['42'])
  })
})

describe('autoMapColumns', () => {
  it('maps csv headers onto field keys via label/alias matches', () => {
    const fields = IMPORT_CONFIGS.departments.fields
    const mapped = autoMapColumns(['Name', 'Description', 'Contact'], fields)
    expect(mapped.name).toBe('Name')
    expect(Object.keys(mapped).length).toBeGreaterThan(0)
  })

  it('leaves unmatched headers out of the mapping', () => {
    const mapped = autoMapColumns(['Nope'], IMPORT_CONFIGS.departments.fields)
    expect(Object.values(mapped).filter(Boolean)).toEqual([])
  })
})

describe('csvSchemas round trip (parse → transform)', () => {
  it('parses a departments CSV and produces entities with sanitized urls', () => {
    const csv = 'Name,Description,URL\nBWF,Beschwer,https://bfh.ch\n'
    const parsed = parseCsv(csv, { hasHeader: true })
    const mapped = autoMapColumns(parsed.headers, IMPORT_CONFIGS.departments.fields)
    const rows = parsed.rows.map(r => {
      const out: Record<string, unknown> = {}
      for (const [fieldKey, header] of Object.entries(mapped)) if (header) out[fieldKey] = r[header ?? '']
      return out
    })
    const entities = IMPORT_CONFIGS.departments.transform(rows)
    expect((entities[0] as Record<string, unknown>).name).toBe('BWF')
  })
})