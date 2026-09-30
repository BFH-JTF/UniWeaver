import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Competency } from '@/types/competency'

function emptyCompetency(): Competency {
  return {
    name: '',
    category: '',
    description: '',
    level: undefined,
  }
}

export function useCompetencies() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const competencies = ref<Competency[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCompetencies() {
    loading.value = true
    error.value = null
    try {
      competencies.value = await fetchEntities<Competency>(EntityTables.COMPETENCY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addCompetency(competency: Competency) {
    error.value = null
    try {
      const saved = await createEntity<Competency>(EntityTables.COMPETENCY, competency)
      competency.id = saved.id
      competencies.value = await fetchEntities<Competency>(EntityTables.COMPETENCY)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateCompetency(competency: Competency) {
    const id = competency.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.COMPETENCY, id, competency)
      const idx = competencies.value.findIndex(c => c.id === id)
      if (idx !== -1) competencies.value[idx] = competency
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeCompetency(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.COMPETENCY, id)
      competencies.value = competencies.value.filter(c => c.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importCompetencies(items: Competency[]): Promise<Competency[]> {
    error.value = null
    const imported: Competency[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<Competency>(EntityTables.COMPETENCY, item)
        item.id = saved.id
        imported.push(item)
      }
      competencies.value = await fetchEntities<Competency>(EntityTables.COMPETENCY)
      return imported
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importCsv(text: string): Promise<Competency[]> {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row')

    const headers = (lines[0] ?? '').split(',').map(h => h.trim().toLowerCase())
    const imported: Competency[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const values = line.split(',').map(v => v.trim())
      if (values.length !== headers.length) continue
      const obj: Record<string, string> = {}
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j]
        if (h !== undefined) obj[h] = values[j] ?? ''
      }
      const comp: Competency = {
        name: obj.name || obj.topic || obj.category || 'Unnamed Competency',
        category: obj.category || undefined,
        topic: obj.topic || undefined,
        description: obj.description || undefined,
        level: obj.level as any,
      }
      await addCompetency(comp)
      imported.push(comp)
    }

    return imported
  }

  return {
    competencies,
    loading,
    error,
    fetchCompetencies,
    addCompetency,
    updateCompetency,
    removeCompetency,
    importCompetencies,
    importCsv,
    emptyCompetency,
  }
}
