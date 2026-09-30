import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { MatrixCompetency } from '@/types/matrixCompetency'

function emptyMatrixCompetency(): MatrixCompetency {
  return {
    name: '',
    category: '',
    description: '',
    level: undefined,
    matrixAxis: 'x',
  }
}

export function useMatrixCompetencies() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const matrixCompetencies = ref<MatrixCompetency[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMatrixCompetencies() {
    loading.value = true
    error.value = null
    try {
      matrixCompetencies.value = await fetchEntities<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addMatrixCompetency(item: MatrixCompetency) {
    error.value = null
    try {
      const saved = await createEntity<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY, item)
      item.id = saved.id
      matrixCompetencies.value = await fetchEntities<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateMatrixCompetency(item: MatrixCompetency) {
    const id = item.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.MATRIX_COMPETENCY, id, item)
      const idx = matrixCompetencies.value.findIndex(c => c.id === id)
      if (idx !== -1) matrixCompetencies.value[idx] = item
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeMatrixCompetency(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.MATRIX_COMPETENCY, id)
      matrixCompetencies.value = matrixCompetencies.value.filter(c => c.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importMatrixCompetencies(items: MatrixCompetency[]): Promise<MatrixCompetency[]> {
    error.value = null
    const imported: MatrixCompetency[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY, item)
        item.id = saved.id
        imported.push(item)
      }
      matrixCompetencies.value = await fetchEntities<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY)
      return imported
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    matrixCompetencies,
    loading,
    error,
    fetchMatrixCompetencies,
    addMatrixCompetency,
    updateMatrixCompetency,
    removeMatrixCompetency,
    importMatrixCompetencies,
    emptyMatrixCompetency,
  }
}