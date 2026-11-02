import { describe, expect, it } from 'vitest'
import { parseCsv } from './csvParser'
import { csvHeaderSelectOptionsFor, formatPreviewCell, transformCsvRowsWithMapping } from './csvPreview'
import { IMPORT_CONFIGS } from './csvSchemas'

describe('formatPreviewCell', () => {
  it('renders booleans readably', () => {
    expect(formatPreviewCell({ flag: true }, 'flag')).toBe('Yes (true)')
    expect(formatPreviewCell({ flag: false }, 'flag')).toBe('No (false)')
  })

  it('renders nested objects as JSON', () => {
    expect(formatPreviewCell({ accessibility: { seats: 3 } }, 'accessibility')).toBe('{"seats":3}')
  })

  it('returns "" for empty, null and undefined cells', () => {
    expect(formatPreviewCell({ x: '' }, 'x')).toBe('')
    expect(formatPreviewCell({ x: null }, 'x')).toBe('')
    expect(formatPreviewCell({ x: undefined }, 'x')).toBe('')
  })

  it('unwraps accessibility_step_free_access into the nested object', () => {
    expect(formatPreviewCell({ accessibility: { step_free_access: true } }, 'accessibility_step_free_access')).toBe('Yes (true)')
  })

  it('unwraps sub-keys only for the known composite groups (layout_/equipment_/connectivity_/accessibility_)', () => {
    expect(formatPreviewCell({ capacity: { seats: 42 } }, 'capacity_seats')).toBe('')
    expect(formatPreviewCell({ layout: { rows: '2+2' } }, 'layout_rows')).toBe('2+2')
    expect(formatPreviewCell({ equipment: { beamer: true } }, 'equipment_beamer')).toBe('Yes (true)')
  })

  it('is safe on empty rows', () => {
    expect(formatPreviewCell({} as Record<string, unknown>, 'anything')).toBe('')
  })
})

describe('transformCsvRowsWithMapping', () => {
  const fields = [
    { key: 'name' },
    { key: 'contact', defaultValue: 'info@bfh.ch' },
    { key: 'ignored' },
  ]

  it('maps csv headers onto field keys per the column mapping and applies defaults', () => {
    const rows = [{ 'Full Name': 'Ada Lovelace' }]
    const out = transformCsvRowsWithMapping(rows, fields, { name: 'Full Name' })
    expect(out).toEqual([{ name: 'Ada Lovelace', contact: 'info@bfh.ch' }])
  })

  it('applies field defaults when no csv header is mapped', () => {
    const out = transformCsvRowsWithMapping([{}], fields, {})
    expect(out[0]).toMatchObject({ contact: 'info@bfh.ch' })
    expect(out[0]).not.toHaveProperty('ignored')
  })

  it('produces one output row per input row and keeps umlauts', () => {
    const rows = [{ H: 'Müller'}, { H: 'Öztürk' }]
    const out = transformCsvRowsWithMapping(rows, [{ key: 'name' }], { name: 'H' })
    expect(out.map(r => r.name)).toEqual(['Müller', 'Öztürk'])
  })

  it('handles empty input', () => {
    expect(transformCsvRowsWithMapping([], fields, {})).toEqual([])
  })
})

describe('csvHeaderSelectOptionsFor', () => {
  it('always offers a skip option first', () => {
    const opts = csvHeaderSelectOptionsFor({ headers: [], rows: [] } as never)
    expect(opts[0]).toMatchObject({ value: null })
  })

  it('adds one option per header with a short sample', () => {
    const parsed = parseCsv('Name,Contact\nAda,ada@bfh.ch\n', { hasHeader: true })
    const opts = csvHeaderSelectOptionsFor(parsed)
    expect(opts).toHaveLength(3)
    expect(opts[1]).toMatchObject({ title: 'Name', value: 'Name' })
    expect(opts[1]!.preview).toContain('Ada')
  })

  it('truncates samples longer than 30 chars and handles empty first row', () => {
    const long = 'x'.repeat(40)
    const parsed = parseCsv(`Name,Contact\n${long},`, { hasHeader: true })
    const opts = csvHeaderSelectOptionsFor(parsed)
    expect(opts[1]!.preview).toContain('...')
    expect(opts[1]!.preview.length).toBeLessThan(50)
    expect(opts[2]!.preview).toBe('Empty in row 1')
  })

  it('returns [] when nothing is parsed yet', () => {
    expect(csvHeaderSelectOptionsFor(null)).toEqual([])
  })
})

describe('IMPORT_CONFIGS integrity (smoke)', () => {
  it('every import type has fields and a transform function', () => {
    for (const cfg of Object.values(IMPORT_CONFIGS)) {
      expect(Array.isArray(cfg.fields)).toBe(true)
      expect(typeof cfg.transform).toBe('function')
    }
  })
})