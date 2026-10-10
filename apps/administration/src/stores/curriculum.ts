import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getApiBaseUrl } from '@uniweaver/shared'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Module } from '@/types/curriculum'
import type { Room } from '@/types/room'
import type { Location } from '@/types/location'

export interface CurriculumVersion {
  _id?: string
  id?: string
  curriculumId?: string
  name: string
  description?: string
  versionNumber: number
  /** @deprecated Use versionNumber instead */
  version?: number
  /** Semester this curriculum version is for (optional) */
  semesterId?: string
  /** User id of the creator; resolved display name in createdByName */
  createdBy?: string
  createdByName?: string
  createdAt?: string
}

export interface Semester {
  _id?: string
  id?: string
  name?: string
  code?: string
  startDate: string
  endDate: string
  /** Length of one timeslot in minutes; slots are the only valid module start times */
  slotDurationMinutes?: number
  /** Sorted HH:MM start points of the timeslots, identical for all weekdays */
  slotStartTimes?: string[]
}

export const useCurriculumStore = defineStore('curriculum', () => {
  const { fetchEntities } = usePostgres()

  const modules = ref<Module[]>([])
  const semesters = ref<Semester[]>([])
  // Rooms and locations are shared scheduling resources, served by the
  // backend under /api/scheduling (not by the generic curriculum API).
  const rooms = ref<Room[]>([])
  const locations = ref<Location[]>([])

  async function fetchModules() {
    modules.value = await fetchEntities<Module>(EntityTables.MODULE)
  }

  async function fetchSemesters() {
    semesters.value = await fetchEntities<Semester>(EntityTables.SEMESTER)
  }

  /** Map a /scheduling/rooms row onto the local Room type. */
  function toRoom(row: any): Room {
    return {
      id: row.id,
      name: row.name || '',
      roomType: row.roomType || 'other',
      locationId: row.locationId || undefined,
      floor: row.floor ?? '',
      roomNumber: row.roomNumber || '',
      capacity: row.capacity ?? 0,
      accessibility: row.accessibility ?? { step_free_access: false },
    }
  }

  async function fetchRooms() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/scheduling/rooms`, { credentials: 'include' })
      rooms.value = res.ok ? ((await res.json()) as any[]).map(toRoom) : []
    } catch {
      // Scheduling API unreachable — rooms only decorate restriction params.
    }
  }

  async function fetchLocations() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/scheduling/locations`, { credentials: 'include' })
      locations.value = res.ok ? (await res.json()) : []
    } catch {
      // Scheduling API unreachable.
    }
  }

  return {
    modules,
    semesters,
    rooms,
    locations,
    fetchModules,
    fetchSemesters,
    fetchRooms,
    fetchLocations,
  }
})