import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { ImportType } from '@/types/csvImport'

export function useCsvImport() {
  const { createEntity } = usePostgres()
  const isImporting = ref(false)
  const importError = ref<string | null>(null)

  const entityTableMap: Record<ImportType, string> = {
    rooms: EntityTables.ROOM,
    locations: EntityTables.LOCATION,
    competencies: EntityTables.COMPETENCY,
    modules: EntityTables.MODULE,
    proofs_of_competency: EntityTables.PROOF_OF_COMPETENCY,
    departments: EntityTables.DEPARTMENT,
    programs: EntityTables.PROGRAM,
    degrees: EntityTables.DEGREE,
    availability: EntityTables.LECTURER_AVAILABILITY,
    room_availability: EntityTables.ROOM_AVAILABILITY,
    weeks: EntityTables.WEEK,
    schedule_entries: EntityTables.SCHEDULE_ENTRY,
    matrix_competencies: EntityTables.MATRIX_COMPETENCY,
  }

  /**
   * Curriculum containment for imported records: programs must carry the
   * curriculum they belong to, modules the curriculum version. The caller
   * resolves these from the currently displayed curriculum/context.
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
      let count = 0
      for (const item of items) {
        if (type === 'programs' && context?.curriculumId) {
          item.curriculumId = context.curriculumId
        }
        if (type === 'modules' && context?.curriculumVersionId) {
          item.curriculumVersionId = context.curriculumVersionId
        }
        await createEntity(tableName, item)
        count++
      }
      return count
    } catch (e: any) {
      importError.value = e.message || 'Failed to save imported records'
      throw e
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
