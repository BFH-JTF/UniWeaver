import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { CurriculumVersion } from '@/stores/curriculum'

export function emptyCurriculumVersion(): CurriculumVersion {
  return {
    name: '',
    versionNumber: 1,
  }
}

export function useCurriculumVersions() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const curriculumVersions = ref<CurriculumVersion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCurriculumVersions() {
    loading.value = true
    error.value = null
    try {
      curriculumVersions.value = await fetchEntities<CurriculumVersion>(EntityTables.CURRICULUM_VERSION)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addCurriculumVersion(version: CurriculumVersion) {
    error.value = null
    try {
      await createEntity<CurriculumVersion>(EntityTables.CURRICULUM_VERSION, version)
      curriculumVersions.value = await fetchEntities<CurriculumVersion>(EntityTables.CURRICULUM_VERSION)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateCurriculumVersion(version: CurriculumVersion) {
    const id = version._id || version.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.CURRICULUM_VERSION, id, version)
      const idx = curriculumVersions.value.findIndex(v => (v._id || v.id) === id)
      if (idx !== -1) curriculumVersions.value[idx] = version
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeCurriculumVersion(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.CURRICULUM_VERSION, id)
      curriculumVersions.value = curriculumVersions.value.filter(v => (v._id || v.id) !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    curriculumVersions,
    loading,
    error,
    fetchCurriculumVersions,
    addCurriculumVersion,
    updateCurriculumVersion,
    removeCurriculumVersion,
    emptyCurriculumVersion,
  }
}