import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Curriculum, CurriculumVersion } from '@/types/curriculum'

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

export function useCurriculums() {
  const { fetchEntities, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const curriculums = ref<Curriculum[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCurriculums() {
    loading.value = true
    error.value = null
    try {
      curriculums.value = await fetchEntities<Curriculum>(EntityTables.CURRICULUM)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createCurriculumWithV1(name: string, description: string) {
    error.value = null
    try {
      const apiUrl = localStorage.getItem('uniweaver_pg_api_url') || 'http://localhost:3000/api'
      const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/curriculums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('uniweaver_oidc_access_token') || localStorage.getItem('uniweaver_oidc_id_token') || ''}`,
        },
        credentials: 'include',
        body: JSON.stringify({ name, description }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as any).error || `API error ${res.status}`)
      }
      const created = await res.json()
      curriculums.value = await fetchEntities<Curriculum>(EntityTables.CURRICULUM)
      return created
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function addVersionToCurriculum(curriculumId: string) {
    error.value = null
    try {
      const apiUrl = localStorage.getItem('uniweaver_pg_api_url') || 'http://localhost:3000/api'
      const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/curriculums/${curriculumId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('uniweaver_oidc_access_token') || localStorage.getItem('uniweaver_oidc_id_token') || ''}`,
        },
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as any).error || `API error ${res.status}`)
      }
      const newVersion = await res.json()
      curriculums.value = await fetchEntities<Curriculum>(EntityTables.CURRICULUM)
      return newVersion
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function setActiveVersion(curriculumId: string, versionId: string) {
    error.value = null
    try {
      await updateDbEntity(EntityTables.CURRICULUM, curriculumId, { activeVersionId: versionId } as any)
      const idx = curriculums.value.findIndex(c => (c._id || c.id) === curriculumId)
      if (idx !== -1) {
        const c = curriculums.value[idx]
        if (c) c.activeVersionId = versionId
      }
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateCurriculum(curriculum: Curriculum) {
    const id = curriculum._id || curriculum.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.CURRICULUM, id, curriculum)
      const idx = curriculums.value.findIndex(c => (c._id || c.id) === id)
      if (idx !== -1) curriculums.value[idx] = curriculum
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeCurriculum(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.CURRICULUM, id)
      curriculums.value = curriculums.value.filter(c => (c._id || c.id) !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    curriculums,
    loading,
    error,
    fetchCurriculums,
    createCurriculumWithV1,
    addVersionToCurriculum,
    setActiveVersion,
    updateCurriculum,
    removeCurriculum,
  }
}
