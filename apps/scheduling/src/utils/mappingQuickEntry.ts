import type { MappingPairPatch } from '@uniweaver/shared'

export interface QuickEntryCandidate {
  id: string
  /** The raw entry string the id was matched from. */
  raw: string
}

export interface QuickEntryMatch {
  matched: QuickEntryCandidate[]
  unknown: string[]
}

/** Match free-text module codes/names onto module ids (case-insensitive). */
export function matchModuleCodes(
  entries: string[],
  modules: Array<{ id: string; code?: string; name: string }>,
): QuickEntryMatch {
  const matched: QuickEntryCandidate[] = []
  const unknown: string[] = []
  for (const raw of entries) {
    const code = raw.trim().toUpperCase()
    const module = modules.find(
      m => (m.code || '').toUpperCase() === code || m.name.toUpperCase() === code,
    )
    if (module) matched.push({ id: module.id, raw })
    else unknown.push(raw)
  }
  return { matched, unknown }
}

/** Match free-text lecturer names onto lecturer ids (case-insensitive). */
export function matchLecturerNames(
  entries: string[],
  lecturers: Array<{ id: string; name: string }>,
): QuickEntryMatch {
  const matched: QuickEntryCandidate[] = []
  const unknown: string[] = []
  for (const raw of entries) {
    const name = raw.trim().toLowerCase()
    const lecturer = lecturers.find(l => l.name.toLowerCase() === name)
    if (lecturer) matched.push({ id: lecturer.id, raw })
    else unknown.push(raw)
  }
  return { matched, unknown }
}

export interface CopyDiffOptions {
  /** The copy source selection (mode decides whether it is a lecturer or module id). */
  mode: () => 'lecturer' | 'module'
  targetId: () => string
  sourceId: () => string | null
  /** Mapped partner ids per lecturer (lecturer → module ids). */
  byLecturer: () => Map<string, string[]>
  /** Mapped partner ids per module (module → lecturer ids). */
  byModule: () => Map<string, string[]>
}

/**
 * Builds the pair diff for "copy mapping from another entity": pairs the
 * target has that the source lacks are removed, all source pairs are added
 * (replace semantics). Returns [] when the target already mirrors the source.
 */
export function buildCopyPairDiff(options: CopyDiffOptions): Array<{ lecturerId: string, moduleId: string, value: 0 | 1 }> {
  const mode = options.mode()
  const targetId = options.targetId()
  const sourceId = options.sourceId()
  if (!targetId || !sourceId) return []

  const currentKeys =
    mode === 'lecturer'
      ? (options.byLecturer().get(targetId) ?? []).map(moduleId => ({ lecturerId: targetId, moduleId }))
      : (options.byModule().get(targetId) ?? []).map(lecturerId => ({ lecturerId, moduleId: targetId }))

  const sourceKeys =
    mode === 'lecturer'
      ? (options.byLecturer().get(sourceId) ?? []).map(moduleId => ({ lecturerId: targetId, moduleId }))
      : (options.byModule().get(sourceId) ?? []).map(lecturerId => ({ lecturerId, moduleId: targetId }))

  const sourceKeySet = new Set(sourceKeys.map(k => `${k.lecturerId}\n${k.moduleId}`))
  const diff: MappingPairPatch[] = [
    ...currentKeys
      .filter(k => !sourceKeySet.has(`${k.lecturerId}\n${k.moduleId}`))
      .map(k => ({ ...k, value: 0 as const })),
    ...sourceKeys.map(k => ({ ...k, value: 1 as const })),
  ]
  return diff as Array<{ lecturerId: string, moduleId: string, value: 0 | 1 }>
}