import { ref } from 'vue'
import { ApiRequestError, errorMessage } from '@uniweaver/shared'
import { usePostgres, EntityTables, type EntityTableName } from '@/composables/usePostgres'
import type { ImportType } from '@/types/csvImport'

export function useCsvImport() {
  const { importEntities } = usePostgres()
  const isImporting = ref(false)
  const importError = ref<string | null>(null)

  const entityTableMap: Record<ImportType, EntityTableName> = {
    modules: EntityTables.MODULE,
    classes: EntityTables.CLASS,
    departments: EntityTables.DEPARTMENT,
    programs: EntityTables.PROGRAM,
    degrees: EntityTables.DEGREE,
  }

  /**
   * Curriculum containment for imported records: programs must carry the
   * curriculum they belong to, modules and classes the curriculum version.
   * The caller resolves these from the currently displayed curriculum/context.
   *
   * All rows are sent in a single batch request; the backend validates every
   * row first and inserts atomically, so imports are all-or-nothing.
   */
  async function saveImportedData(
    type: ImportType,
    items: Record<string, unknown>[],
    context?: { curriculumId?: string; curriculumVersionId?: string },
  ): Promise<number> {
    isImporting.value = true
    importError.value = null
    const tableName = entityTableMap[type]

    try {
      const rows = items.map(item => {
        const row = { ...item }
        delete row.created_at
        delete row.updated_at
        if (type === 'programs' && context?.curriculumId) {
          row.curriculumId = context.curriculumId
        }
        if ((type === 'modules' || type === 'classes') && context?.curriculumVersionId) {
          row.curriculumVersionId = context.curriculumVersionId
        }
        return row
      })
      const saved = await importEntities(tableName, rows)
      return saved.length
    } catch (e) {
      const details = e instanceof ApiRequestError
        ? (e.body as { details?: { row?: number; message?: string }[] } | undefined)?.details
        : undefined
      let message = errorMessage(e) || 'Failed to save imported records'
      if (Array.isArray(details) && details.length > 0) {
        const shown = details
          .slice(0, 5)
          .map((d) => `Row ${(d.row ?? 0) + 1}: ${d.message}`)
        if (details.length > 5) {
          shown.push(`… and ${details.length - 5} more error${details.length - 5 === 1 ? '' : 's'}`)
        }
        message = `Import failed (nothing was saved): ${shown.join(' · ')}`
      }
      importError.value = message
      throw new Error(message, { cause: e })
    } finally {
      isImporting.value = false
    }
  }

  return {
    isImporting,
    importError,
    saveImportedData,
  }
}
