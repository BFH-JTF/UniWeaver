import { ref } from 'vue'
import { usePostgres, EntityTables, type EntityTableName } from '@/composables/usePostgres'
import type { ImportType } from '@/types/csvImport'

export function useCsvImport() {
  const { importEntities } = usePostgres()
  const isImporting = ref(false)
  const importError = ref<string | null>(null)

  const entityTableMap: Record<ImportType, EntityTableName> = {
    modules: EntityTables.MODULE,
    departments: EntityTables.DEPARTMENT,
    programs: EntityTables.PROGRAM,
    degrees: EntityTables.DEGREE,
  }

  /**
   * Curriculum containment for imported records: programs must carry the
   * curriculum they belong to, modules the curriculum version. The caller
   * resolves these from the currently displayed curriculum/context.
   *
   * All rows are sent in a single batch request; the backend validates every
   * row first and inserts atomically, so imports are all-or-nothing.
   */
  async function saveImportedData(
    type: ImportType,
    items: any[],
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
        if (type === 'modules' && context?.curriculumVersionId) {
          row.curriculumVersionId = context.curriculumVersionId
        }
        return row
      })
      const saved = await importEntities(tableName, rows)
      return saved.length
    } catch (e: any) {
      const details: any[] | undefined = e?.body?.details
      let message = e?.message || 'Failed to save imported records'
      if (Array.isArray(details) && details.length > 0) {
        const shown = details
          .slice(0, 5)
          .map((d: any) => `Row ${(d.row ?? 0) + 1}: ${d.message}`)
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
