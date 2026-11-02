import { errorMessage } from '@uniweaver/shared'
import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Department } from '@/types/curriculum'

function emptyDepartment(): Department {
  return {
    name: '',
  }
}

export function useDepartments() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const departments = ref<Department[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDepartments() {
    loading.value = true
    error.value = null
    try {
      departments.value = await fetchEntities<Department>(EntityTables.DEPARTMENT)
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function addDepartment(department: Department) {
    error.value = null
    try {
      await createEntity<Department>(EntityTables.DEPARTMENT, department)
      departments.value = await fetchEntities<Department>(EntityTables.DEPARTMENT)
    } catch (e) {
      error.value = errorMessage(e)
      throw e
    }
  }

  async function updateDepartment(department: Department) {
    const id = department.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.DEPARTMENT, id, department)
      const idx = departments.value.findIndex(d => d.id === id)
      if (idx !== -1) departments.value[idx] = department
    } catch (e) {
      error.value = errorMessage(e)
      throw e
    }
  }

  async function removeDepartment(id: string, confirmRef = false) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.DEPARTMENT, id, confirmRef)
      departments.value = departments.value.filter(d => d.id !== id)
    } catch (e) {
      error.value = errorMessage(e)
      throw e
    }
  }

  return {
    departments,
    loading,
    error,
    fetchDepartments,
    addDepartment,
    updateDepartment,
    removeDepartment,
    emptyDepartment,
  }
}