import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Degree } from '@/types/curriculum'
import { normalizeDegree } from '@/utils/curriculumNormalize'

function emptyDegree(): Degree {
  return {
    name: '',
    ProgramIDs: [],
    programIDs: [],
    programIds: [],
  }
}

export function useDegrees() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const degrees = ref<Degree[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDegrees() {
    loading.value = true
    error.value = null
    try {
      degrees.value = await fetchEntities<Degree>(EntityTables.DEGREE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addDegree(degree: Degree) {
    error.value = null
    try {
      const normalized = normalizeDegree(degree)
      await createEntity<Degree>(EntityTables.DEGREE, normalized)
      degrees.value = await fetchEntities<Degree>(EntityTables.DEGREE)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateDegree(degree: Degree) {
    const id = degree.id
    if (!id) return
    error.value = null
    try {
      const normalized = normalizeDegree(degree)
      await updateDbEntity(EntityTables.DEGREE, id, normalized)
      const idx = degrees.value.findIndex(d => d.id === id)
      if (idx !== -1) degrees.value[idx] = normalized
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeDegree(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.DEGREE, id)
      degrees.value = degrees.value.filter(d => d.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    degrees,
    loading,
    error,
    fetchDegrees,
    addDegree,
    updateDegree,
    removeDegree,
    emptyDegree,
  }
}