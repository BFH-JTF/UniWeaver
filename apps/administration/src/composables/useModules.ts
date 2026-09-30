import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Module } from '@/types/curriculum'
import { normalizeModule } from '@/utils/curriculumNormalize'

function emptyModule(): Module {
  return {
    name: '',
    DegreeIDs: [],
    degreeIDs: [],
    degreeIds: [],
  }
}

export function useModules() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const modules = ref<Module[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchModules() {
    loading.value = true
    error.value = null
    try {
      modules.value = await fetchEntities<Module>(EntityTables.MODULE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addModule(mod: Module) {
    error.value = null
    try {
      const normalized = normalizeModule(mod)
      await createEntity<Module>(EntityTables.MODULE, normalized)
      modules.value = await fetchEntities<Module>(EntityTables.MODULE)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateModule(mod: Module) {
    const id = mod.id
    if (!id) return
    error.value = null
    try {
      const normalized = normalizeModule(mod)
      await updateDbEntity(EntityTables.MODULE, id, normalized)
      const idx = modules.value.findIndex(m => m.id === id)
      if (idx !== -1) modules.value[idx] = normalized
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeModule(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.MODULE, id)
      modules.value = modules.value.filter(m => m.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    modules,
    loading,
    error,
    fetchModules,
    addModule,
    updateModule,
    removeModule,
    emptyModule,
  }
}