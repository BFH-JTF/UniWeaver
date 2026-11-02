import type { ParsedCsv } from '@/utils/csvParser'

/** One mapped preview/import row: arbitrary entity fields, keyed by CSV field key. */
export type CsvRow = Record<string, unknown>

/** Nested lookups like `row.accessibility.step_free_access` for flat header keys. */
export function formatPreviewCell(row: CsvRow, key: string): string {
  if (!row) return ''
  const parts = key.split('_')
  let val: unknown = row[key]
  if (val === undefined) {
    if (key === 'accessibility_step_free_access') val = (row.accessibility as CsvRow | undefined)?.step_free_access
    else if (key.startsWith('layout_')) val = (row.layout as CsvRow | undefined)?.[parts.slice(1).join('_')]
    else if (key.startsWith('equipment_')) val = (row.equipment as CsvRow | undefined)?.[parts.slice(1).join('_')]
    else if (key.startsWith('connectivity_')) val = (row.connectivity as CsvRow | undefined)?.[parts.slice(1).join('_')]
  }

  if (typeof val === 'boolean') return val ? 'Yes (true)' : 'No (false)'
  if (val === null || val === undefined || val === '') return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

interface FieldLike {
  key: string
  defaultValue?: unknown
}

/** Map CSV rows onto entity field keys using the user's column mapping. */
export function transformCsvRowsWithMapping(
  rows: Record<string, string>[],
  fields: FieldLike[],
  columnMapping: Record<string, string>,
): Record<string, unknown>[] {
  return rows.map(csvRow => {
    const obj: Record<string, unknown> = {}
    for (const field of fields) {
      const csvHeader = columnMapping[field.key]
      if (csvHeader && csvRow[csvHeader] !== undefined) {
        obj[field.key] = csvRow[csvHeader]
      } else if (field.defaultValue !== undefined) {
        obj[field.key] = field.defaultValue
      }
    }
    return obj
  })
}

/** CSV header → select options with a first-row sample preview. */
export function csvHeaderSelectOptionsFor(
  parsed: ParsedCsv | null,
): Array<{ title: string; value: string | null; preview: string }> {
  if (!parsed) return []
  const options = [{ title: '(None / Do not import)', value: null as string | null, preview: 'Will be skipped' }]
  for (const header of parsed.headers) {
    const sampleVal = parsed.rows[0]?.[header] ?? ''
    const preview = sampleVal ? `Sample: "${sampleVal.length > 30 ? sampleVal.substring(0, 30) + '...' : sampleVal}"` : 'Empty in row 1'
    options.push({
      title: header,
      value: header,
      preview,
    })
  }
  return options
}