import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Location } from '@/types/location'

function emptyLocation(): Location {
  return {
    name: '',
    building: '',
  }
}

function parseCsvRow(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i]
    if (key !== undefined) obj[key] = row[i]?.trim() ?? ''
  }
  return obj
}

function csvToLocation(obj: Record<string, string>): Location {
  const loc = emptyLocation()
  loc.name = obj.name ?? ''
  loc.campus = obj.campus || undefined
  loc.building = obj.building ?? ''
  loc.address = obj.address || undefined
  if (obj.latitude) loc.latitude = Number(obj.latitude) || undefined
  if (obj.longitude) loc.longitude = Number(obj.longitude) || undefined
  return loc
}

export function useLocations() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const locations = ref<Location[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchLocations() {
    loading.value = true
    error.value = null
    try {
      locations.value = await fetchEntities<Location>(EntityTables.LOCATION)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addLocation(location: Location) {
    error.value = null
    try {
      const saved = await createEntity<Location>(EntityTables.LOCATION, location)
      location.id = saved.id
      locations.value = await fetchEntities<Location>(EntityTables.LOCATION)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateLocation(location: Location) {
    const id = location.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.LOCATION, id, location)
      const idx = locations.value.findIndex(l => l.id === id)
      if (idx !== -1) locations.value[idx] = location
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeLocation(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.LOCATION, id)
      locations.value = locations.value.filter(l => l.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importLocations(items: Location[]): Promise<Location[]> {
    error.value = null
    const imported: Location[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<Location>(EntityTables.LOCATION, item)
        item.id = saved.id
        imported.push(item)
      }
      locations.value = await fetchEntities<Location>(EntityTables.LOCATION)
      return imported
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importCsv(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row')

    const headers = (lines[0] ?? '').split(',').map(h => h.trim())
    const imported: Location[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const values = line.split(',').map(v => v.trim())
      if (values.length !== headers.length) continue
      const obj = parseCsvRow(headers, values)
      const loc = csvToLocation(obj)
      await addLocation(loc)
      imported.push(loc)
    }

    return imported
  }

  return {
    locations,
    loading,
    error,
    fetchLocations,
    addLocation,
    updateLocation,
    removeLocation,
    importLocations,
    importCsv,
    emptyLocation,
  }
}