import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { ClassEntity } from '@/types/curriculumClass'

export function emptyClass(): ClassEntity {
  return {
    name: '',
    programIds: [],
  }
}

export function useClasses() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const classes = ref<ClassEntity[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClasses() {
    loading.value = true
    error.value = null
    try {
      classes.value = await fetchEntities<ClassEntity>(EntityTables.CLASS)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addClass(cls: ClassEntity) {
    error.value = null
    try {
      await createEntity<ClassEntity>(EntityTables.CLASS, cls)
      classes.value = await fetchEntities<ClassEntity>(EntityTables.CLASS)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateClass(cls: ClassEntity) {
    const id = cls.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.CLASS, id, cls)
      const idx = classes.value.findIndex(c => c.id === id)
      if (idx !== -1) classes.value[idx] = cls
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeClass(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.CLASS, id)
      classes.value = classes.value.filter(c => c.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    classes,
    loading,
    error,
    fetchClasses,
    addClass,
    updateClass,
    removeClass,
    emptyClass,
  }
}