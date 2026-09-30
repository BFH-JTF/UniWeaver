import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Program } from '@/types/curriculum'
import { normalizeProgram } from '@/utils/curriculumNormalize'

function emptyProgram(): Program {
  return {
    name: '',
    departmentIDs: [],
    departmentIds: [],
  }
}

export function usePrograms() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const programs = ref<Program[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPrograms() {
    loading.value = true
    error.value = null
    try {
      programs.value = await fetchEntities<Program>(EntityTables.PROGRAM)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addProgram(program: Program) {
    error.value = null
    try {
      const normalized = normalizeProgram(program)
      await createEntity<Program>(EntityTables.PROGRAM, normalized)
      programs.value = await fetchEntities<Program>(EntityTables.PROGRAM)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateProgram(program: Program) {
    const id = program.id
    if (!id) return
    error.value = null
    try {
      const normalized = normalizeProgram(program)
      await updateDbEntity(EntityTables.PROGRAM, id, normalized)
      const idx = programs.value.findIndex(p => p.id === id)
      if (idx !== -1) programs.value[idx] = normalized
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeProgram(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.PROGRAM, id)
      programs.value = programs.value.filter(p => p.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    programs,
    loading,
    error,
    fetchPrograms,
    addProgram,
    updateProgram,
    removeProgram,
    emptyProgram,
  }
}