import type { ImportFieldDefinition, ImportType, ReferenceTargetSpec } from '@/types/csvImport'
import { IMPORT_CONFIGS, parseStringArray } from '@/utils/csvSchemas'

/** Placeholder token for mandatory reference cells that carry no value at all. */
export const MISSING_TOKEN = '(missing)'

export interface ReferenceIssue {
  /** Unique grouping key of this issue: `${fieldKey}:${token}` */
  key: string
  fieldKey: string
  fieldLabel: string
  target: ReferenceTargetSpec
  /** The unknown ID token, or MISSING_TOKEN for empty mandatory cells */
  token: string
  /** Indices of all mapped rows affected by this issue */
  rowIndices: number[]
}

/** Resolutions map user picks for an issue key onto valid entity IDs. */
export type ReferenceResolutions = Record<string, string | string[] | null | undefined>

/** Reference-bearing field definitions of an import type, in field order. */
export function referenceFields(type: ImportType): ImportFieldDefinition[] {
  return (IMPORT_CONFIGS[type]?.fields ?? []).filter(f => !!f.reference)
}

/**
 * A token is valid if it addresses an existing entity, and — where the
 * backend enforces admin authority over referenced parents (degrees →
 * programs, modules → degrees) — the importing user administers it.
 */
export function isValidReferenceToken(
  target: ReferenceTargetSpec,
  token: string,
  targets: Record<string, any[]>,
  isGlobalAdmin: boolean,
): boolean {
  const list = targets[target.entityTable] ?? []
  const entity = list.find(e => e.id === token || e._id === token)
  if (!entity) return false
  if (target.requireAdmin && !isGlobalAdmin && entity._isAdmin !== true) return false
  return true
}

function normalizeResolution(value: string | string[] | undefined | null): string[] {
  if (value === undefined || value === null) return []
  return (Array.isArray(value) ? value : [value])
    .map(v => (v === null || v === undefined ? '' : String(v)))
    .filter(s => s.length > 0)
}

/**
 * Collects all reference issues across the mapped rows. Resolutions on
 * record (a picked replacement ID, or appended values for empty cells)
 * make the affected tokens count as resolved.
 */
export function collectReferenceIssues(
  type: ImportType,
  mappedRows: Record<string, unknown>[],
  targets: Record<string, any[]>,
  isGlobalAdmin: boolean,
  resolutions: ReferenceResolutions = {},
): ReferenceIssue[] {
  const groups = new Map<string, ReferenceIssue>()

  const add = (field: ImportFieldDefinition, token: string, rowIdx: number): void => {
    const key = `${field.key}:${token}`
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        fieldKey: field.key,
        fieldLabel: field.reference!.entityLabel,
        target: field.reference!,
        token,
        rowIndices: [],
      }
      groups.set(key, group)
    }
    group.rowIndices.push(rowIdx)
  }

  for (const field of referenceFields(type)) {
    const target = field.reference!
    for (let rowIdx = 0; rowIdx < mappedRows.length; rowIdx++) {
      const mappedRow = mappedRows[rowIdx]
      if (!mappedRow) continue
      const tokens = parseStringArray(mappedRow[field.key])
      if (tokens.length === 0) {
        if (!target.required) continue
        const appended = normalizeResolution(resolutions[`${field.key}:${MISSING_TOKEN}`])
        if (appended.some(id => isValidReferenceToken(target, id, targets, isGlobalAdmin))) continue
        add(field, MISSING_TOKEN, rowIdx)
        continue
      }
      for (const token of tokens) {
        if (isValidReferenceToken(target, token, targets, isGlobalAdmin)) continue
        const replacement = normalizeResolution(resolutions[`${field.key}:${token}`])
        if (replacement.some(id => isValidReferenceToken(target, id, targets, isGlobalAdmin))) continue
        add(field, token, rowIdx)
      }
    }
  }
  return [...groups.values()]
}

/**
 * Rewrites the mapped rows with all recorded resolutions applied so the
 * existing transform() functions receive the corrected ID lists: unknown
 * tokens are replaced by the picked entity, empty mandatory cells get the
 * picked values appended. Rows are cloned; the input remains untouched.
 */
export function resolveMappedRows(
  type: ImportType,
  mappedRows: Record<string, unknown>[],
  targets: Record<string, any[]>,
  isGlobalAdmin: boolean,
  resolutions: ReferenceResolutions = {},
): Record<string, unknown>[] {
  return mappedRows.map(row => {
    const corrected = { ...row }
    for (const field of referenceFields(type)) {
      const target = field.reference!
      const tokens = parseStringArray(corrected[field.key])
      const resolved: string[] = []
      if (tokens.length === 0 && target.required) {
        for (const id of normalizeResolution(resolutions[`${field.key}:${MISSING_TOKEN}`])) {
          if (isValidReferenceToken(target, id, targets, isGlobalAdmin)) resolved.push(id)
        }
      }
      for (const token of tokens) {
        if (isValidReferenceToken(target, token, targets, isGlobalAdmin)) {
          resolved.push(token)
          continue
        }
        const replacement = normalizeResolution(resolutions[`${field.key}:${token}`])
        const picked = replacement.find(id => isValidReferenceToken(target, id, targets, isGlobalAdmin))
        if (picked) resolved.push(picked)
        else resolved.push(token)
      }
      if (resolved.length > 0) corrected[field.key] = resolved.join('|')
      else if (tokens.length > 0 || target.required) corrected[field.key] = ''
    }
    return corrected
  })
}