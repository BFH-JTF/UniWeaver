import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Room } from '@/types/room'
import { normalizeRoom } from '@/utils/curriculumNormalize'

function emptyRoom(): Room {
  return {
    name: '',
    roomType: 'classroom',
    floor: 0,
    roomNumber: '',
    capacity: 0,
    accessibility: {
      step_free_access: false,
    },
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

function csvToRoom(obj: Record<string, string>): Room {
  const room = emptyRoom()
  room.name = obj.name ?? ''
  const rt = obj.room_type ?? ''
  if (['lecture_hall', 'classroom', 'computer_lab', 'laboratory', 'other'].includes(rt)) {
    room.roomType = rt as Room['roomType']
  }
  room.owner = obj.owner || undefined
  if (obj.location_id) room.locationId = obj.location_id
  const floorVal = obj.floor ?? ''
  const floorNum = Number(floorVal)
  room.floor = isNaN(floorNum) ? floorVal : floorNum
  room.roomNumber = obj.room_number ?? ''

  room.capacity = Number(obj.capacity_seats) || 0

  if (obj.layout_type) {
    const lt = obj.layout_type
    if (['rows', 'u_shape', 'boardroom', 'laboratory_benches', 'computer_workstations', 'other'].includes(lt)) {
      room.layout = { ...(room.layout ?? {}), type: lt as Room['layout'] extends { type?: infer T } ? T : never }
    }
  }
  if (obj.layout_movable_desks !== undefined) room.layout = { ...(room.layout ?? {}), movable_desks: obj.layout_movable_desks === 'true' }
  if (obj.layout_movable_chairs !== undefined) room.layout = { ...(room.layout ?? {}), movable_chairs: obj.layout_movable_chairs === 'true' }
  if (obj.layout_group_work_possible !== undefined) room.layout = { ...(room.layout ?? {}), group_work_possible: obj.layout_group_work_possible === 'true' }
  if (obj.layout_floor_area_m2) room.layout = { ...(room.layout ?? {}), floor_area_m2: Number(obj.layout_floor_area_m2) || undefined }

  if (obj.equipment_whiteboards || obj.equipment_projector || obj.equipment_flipchart) {
    room.equipment = {
      whiteboards: Number(obj.equipment_whiteboards) || 0,
      flipchart: obj.equipment_flipchart === 'true',
      projector: obj.equipment_projector === 'true',
      streaming_camera: { available: obj.equipment_streaming_camera_available === 'true' },
    }
    if (obj.equipment_blackboard) room.equipment.blackboard = obj.equipment_blackboard === 'true'
    if (obj.equipment_smartboard) room.equipment.smartboard = obj.equipment_smartboard === 'true'
    if (obj.equipment_projector_count) room.equipment.projector_count = Number(obj.equipment_projector_count) || undefined
    if (obj.equipment_document_camera) room.equipment.document_camera = obj.equipment_document_camera === 'true'
    if (obj.equipment_lectern) room.equipment.lectern = obj.equipment_lectern === 'true'
    if (obj.equipment_speakers) room.equipment.speakers = obj.equipment_speakers === 'true'
    if (obj.equipment_microphone) room.equipment.microphone = obj.equipment_microphone === 'true'
    if (obj.equipment_lecture_capture) room.equipment.lecture_capture = obj.equipment_lecture_capture === 'true'
    if (obj.equipment_streaming_camera_type) room.equipment.streaming_camera.type = obj.equipment_streaming_camera_type as any
    if (obj.equipment_streaming_camera_position) room.equipment.streaming_camera.position = obj.equipment_streaming_camera_position
    if (obj.equipment_streaming_camera_quality) room.equipment.streaming_camera.quality = obj.equipment_streaming_camera_quality as any
    if (obj.equipment_video_conferencing_available) {
      room.equipment.video_conferencing = {
        available: obj.equipment_video_conferencing_available === 'true',
      }
      if (obj.equipment_video_conferencing_system) room.equipment.video_conferencing.system = obj.equipment_video_conferencing_system
      if (obj.equipment_video_conferencing_supports_remote) room.equipment.video_conferencing.supports_remote_participants = obj.equipment_video_conferencing_supports_remote === 'true'
    }
  }

  if (obj.connectivity_wifi !== undefined) {
    room.connectivity = {
      wifi: obj.connectivity_wifi === 'true',
      wired_network: obj.connectivity_wired_network === 'true',
      wireless_presentation: obj.connectivity_wireless_presentation === 'true',
    }
    if (obj.connectivity_network_speed_mbps) room.connectivity.network_speed_mbps = Number(obj.connectivity_network_speed_mbps) || undefined
    if (obj.connectivity_power_outlets) room.connectivity.power_outlets = Number(obj.connectivity_power_outlets) || undefined
    if (obj.connectivity_connections) {
      room.connectivity.connections = obj.connectivity_connections.split(';').filter(Boolean) as any[]
    }
  }

  room.accessibility.step_free_access = obj.accessibility_step_free_access === 'true'
  if (obj.accessibility_accessible_door) room.accessibility.accessible_door = obj.accessibility_accessible_door === 'true'
  if (obj.accessibility_accessible_seating) room.accessibility.accessible_seating = obj.accessibility_accessible_seating === 'true'
  if (obj.accessibility_hearing_loop) room.accessibility.hearing_loop = obj.accessibility_hearing_loop === 'true'
  if (obj.accessibility_braille_signage) room.accessibility.braille_signage = obj.accessibility_braille_signage === 'true'
  if (obj.accessibility_accessible_restrooms_nearby) room.accessibility.accessible_restrooms_nearby = obj.accessibility_accessible_restrooms_nearby === 'true'

  if (obj.maintenance_last_updated) {
    room.maintenance = { last_updated: obj.maintenance_last_updated }
  }

  return room
}

export function useRooms() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const rooms = ref<Room[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchRooms() {
    loading.value = true
    error.value = null
    try {
      rooms.value = (await fetchEntities<Room>(EntityTables.ROOM)).map(normalizeRoom)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addRoom(room: Room) {
    error.value = null
    try {
      const saved = await createEntity<Room>(EntityTables.ROOM, room)
      room.id = saved.id
      rooms.value = await fetchEntities<Room>(EntityTables.ROOM)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateRoom(room: Room) {
    const id = room.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.ROOM, id, room)
      const idx = rooms.value.findIndex(r => r.id === id)
      if (idx !== -1) rooms.value[idx] = room
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeRoom(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.ROOM, id)
      rooms.value = rooms.value.filter(r => r.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importRooms(items: Room[]): Promise<Room[]> {
    error.value = null
    const imported: Room[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<Room>(EntityTables.ROOM, item)
        item.id = saved.id
        imported.push(item)
      }
      rooms.value = await fetchEntities<Room>(EntityTables.ROOM)
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
    const imported: Room[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? ''
      const values = line.split(',').map(v => v.trim())
      if (values.length !== headers.length) continue
      const obj = parseCsvRow(headers, values)
      const room = csvToRoom(obj)
      await addRoom(room)
      imported.push(room)
    }

    return imported
  }

  return {
    rooms,
    loading,
    error,
    fetchRooms,
    addRoom,
    updateRoom,
    removeRoom,
    importRooms,
    importCsv,
    emptyRoom,
  }
}