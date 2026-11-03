import { computed, ref } from 'vue'
import type { ImportType, ReferenceTargetSpec } from '@/types/csvImport'
import type { ParsedCsv } from '@/utils/csvParser'
import { usePostgres, EntityTables, type EntityTableName } from '@/composables/usePostgres'
import { collectReferenceIssues } from '@/utils/csvReferenceResolution'

const TARGET_TABLES: Record<ReferenceTargetSpec['entityTable'], EntityTableName> = {
  departments: EntityTables.DEPARTMENT,
  programs: EntityTables.PROGRAM,
  degrees: EntityTables.DEGREE,
  semesters: EntityTables.SEMESTER,
  modules: EntityTables.MODULE,
}

export interface UseCsvReferencesOptions {
  /** Currently selected import type. */
  selectedType: () => ImportType
  /** Reference fields of the current type (from csvSchemas). */
  referenceFields: () => Array<{ reference?: ReferenceTargetSpec }>
  /** Parsed CSV (null before parsing). */
  parsedCsv: () => ParsedCsv | null
  /** Fully mapped rows of the whole CSV (for issue scanning). */
  allMappedRows: () => Record<string, unknown>[]
  /** Row count shown in the preview (cell keys are 0-based against it). */
  previewRowCount: () => number
  /** Whether the current user may pick entities flagged requireAdmin. */
  isAdmin: () => boolean
  /** Error surface of the dialog. */
  setError: (message: string) => void
}

/**
 * Reference-resolution state of the CSV import dialog: lazily loads the
 * entity lists a pending import must validate IDs against, exposes picker
 * items, missing-resolution storage, and computes the outstanding issues.
 */
export function useCsvReferences(options: UseCsvReferencesOptions) {
  const { fetchEntities } = usePostgres()

  const targetEntities = ref<Record<string, Record<string, unknown>[]>>({})
  const targetEntitiesLoaded = ref<Record<string, boolean>>({})
  const referenceResolutions = ref<Record<string, string[] | undefined>>({})

  /** Loads the target entity lists a pending import needs to validate IDs against. */
  async function ensureTargetEntities(): Promise<void> {
    for (const field of options.referenceFields()) {
      const table = field.reference!.entityTable
      if (targetEntitiesLoaded.value[table]) continue
      targetEntitiesLoaded.value[table] = true
      fetchEntities<Record<string, unknown>>(TARGET_TABLES[table])
        .then(items => {
          targetEntities.value = { ...targetEntities.value, [table]: items }
        })
        .catch((err) => {
          targetEntitiesLoaded.value[table] = false
          options.setError(err instanceof Error ? err.message : `Failed to load ${table} for reference validation`)
        })
    }
  }

  function referencePickerItems(target: ReferenceTargetSpec) {
    const list = targetEntities.value[target.entityTable] ?? []
    const selectable = target.requireAdmin && !options.isAdmin()
      ? list.filter(e => e._isAdmin === true)
      : list
    return selectable.map((e: Record<string, unknown> & { name?: string; id?: string }) => ({
      title: e.name || e.id || 'Unnamed',
      subtitle: e.id,
      value: e.id,
    }))
  }

  function missingResolution(key: string): string[] | undefined | null {
    return referenceResolutions.value[key] as string[] | undefined | null
  }

  function setMissingResolution(key: string, value: string[] | null | undefined): void {
    referenceResolutions.value[key] = value ?? undefined
  }

  const referenceIssues = computed(() => {
    if (!options.parsedCsv() || options.referenceFields().length === 0) return []
    return collectReferenceIssues(
      options.selectedType(),
      options.allMappedRows(),
      targetEntities.value,
      options.isAdmin(),
      referenceResolutions.value
    )
  })

  const referencesValid = computed(() => referenceIssues.value.length === 0)

  const referenceStatusText = computed(() => {
    const count = referenceIssues.value.length
    return `${count} unresolved reference${count === 1 ? '' : 's'}`
  })

  /** Preview cells (rowIdx:fieldKey) that still contain unresolved references. */
  const previewInvalidCellKeys = computed(() => {
    const keys = new Set<string>()
    const previewCount = options.previewRowCount()
    for (const issue of referenceIssues.value) {
      for (const idx of issue.rowIndices) {
        if (idx < previewCount) keys.add(`${idx}:${issue.fieldKey}`)
      }
    }
    return keys
  })

  function resetResolutions(): void {
    referenceResolutions.value = {}
  }

  return {
    targetEntities,
    targetEntitiesLoaded,
    referenceResolutions,
    ensureTargetEntities,
    referencePickerItems,
    missingResolution,
    setMissingResolution,
    referenceIssues,
    referencesValid,
    referenceStatusText,
    previewInvalidCellKeys,
    resetResolutions,
  }
}
