import { computed, ref } from 'vue'
import type { RoomAvailabilitySlot, SchedulerRoom, Weekday } from '@uniweaver/shared'
import { api, errorMessage } from '@uniweaver/shared'

export type AvailabilitySlotInput = Array<Omit<RoomAvailabilitySlot, 'id' | 'roomId'>>

export interface UseRoomAvailabilityOptions {
  onError: (message: string) => void
  onMessage: (message: string) => void
  /** Rooms list (kept current by the view) — used to update availability counts. */
  rooms: () => SchedulerRoom[]
}

/**
 * Availability-dialog state for one room at a time: load existing slots,
 * add slots locally with validation, copy availability from another room,
 * persist through the scheduling API.
 */
export function useRoomAvailability(options: UseRoomAvailabilityOptions) {
  const availabilityDialogOpen = ref(false)
  const availabilityRoomId = ref('')
  const availabilityRoomName = ref('')
  const availabilitySlots = ref<AvailabilitySlotInput>([])
  const savedSlots = ref<Map<string, string>>(new Map())
  const savingAvailability = ref(false)
  const newSlotWeekday = ref<Weekday>('monday')
  const newSlotStart = ref('08:00')
  const newSlotEnd = ref('12:00')
  const copyAvailabilityFromId = ref<string | null>(null)
  const copyingAvailability = ref(false)
  const availabilitySourceCache = ref<Map<string, AvailabilitySlotInput>>(new Map())
  const slotValidationError = ref('')

  const copyAvailabilitySourceItems = computed(() =>
    options.rooms()
      .filter(r => r.id !== availabilityRoomId.value)
      .map(r => ({ title: r.name, value: r.id, subtitle: `${r.availabilityCount ?? 0} Slots` })),
  )

  function copySourceSlotCount(roomId: string): number {
    return availabilitySourceCache.value.get(roomId)?.length ?? 0
  }

  async function copyAvailability(): Promise<void> {
    if (!copyAvailabilityFromId.value) return
    const sourceId = copyAvailabilityFromId.value
    copyingAvailability.value = true
    try {
      if (!availabilitySourceCache.value.has(sourceId)) {
        const sourceSlots = await api.listRoomAvailability(sourceId)
        availabilitySourceCache.value.set(
          sourceId,
          sourceSlots.map(({ roomId: _roomId, id: _id, ...rest }) => rest),
        )
      }
      availabilitySlots.value = [...(availabilitySourceCache.value.get(sourceId) ?? [])]
    } catch (err) {
      options.onError(errorMessage(err) || 'Failed to copy availability')
    } finally {
      copyingAvailability.value = false
    }
  }

  function openAvailabilityDialog(room: SchedulerRoom): void {
    availabilityRoomId.value = room.id
    availabilityRoomName.value = room.name
    availabilitySlots.value = []
    savedSlots.value = new Map()
    copyAvailabilityFromId.value = null
    availabilitySourceCache.value = new Map()
    slotValidationError.value = ''
    availabilityDialogOpen.value = true
    void (async () => {
      try {
        const slots = await api.listRoomAvailability(room.id)
        savedSlots.value = new Map(slots.map(s => [s.id, s.id]))
        availabilitySlots.value = slots.map(({ roomId: _roomId, id: _id, ...rest }) => rest)
      } catch (err) {
        options.onError(errorMessage(err) || 'Failed to load availability')
        availabilityDialogOpen.value = false
      }
    })()
  }

  function computeSlotError(): string {
    if (!newSlotStart.value || !newSlotEnd.value) return ''
    if (newSlotEnd.value <= newSlotStart.value) return 'End time must be after start time.'
    return ''
  }

  function addLocalSlot(): void {
    const err = computeSlotError()
    slotValidationError.value = err
    if (err) return
    const duplicate = availabilitySlots.value.some(
      s => s.weekday === newSlotWeekday.value && s.startTime === newSlotStart.value && s.endTime === newSlotEnd.value,
    )
    if (duplicate) {
      slotValidationError.value = 'This slot already exists.'
      return
    }
    availabilitySlots.value.push({
      weekId: null,
      weekday: newSlotWeekday.value,
      startTime: newSlotStart.value,
      endTime: newSlotEnd.value,
    })
    slotValidationError.value = ''
  }

  async function saveAvailability(): Promise<void> {
    savingAvailability.value = true
    try {
      await api.setRoomAvailability(availabilityRoomId.value, availabilitySlots.value)
      const room = options.rooms().find(r => r.id === availabilityRoomId.value)
      if (room) room.availabilityCount = availabilitySlots.value.length
      options.onMessage(`Availability of "${availabilityRoomName.value}" saved (${availabilitySlots.value.length} slots).`)
      availabilityDialogOpen.value = false
    } catch (err) {
      options.onError(errorMessage(err) || 'Failed to save availability')
    } finally {
      savingAvailability.value = false
    }
  }

  return {
    availabilityDialogOpen,
    availabilityRoomId,
    availabilityRoomName,
    availabilitySlots,
    savedSlots,
    savingAvailability,
    newSlotWeekday,
    newSlotStart,
    newSlotEnd,
    copyAvailabilityFromId,
    copyingAvailability,
    copyAvailabilitySourceItems,
    copySourceSlotCount,
    copyAvailability,
    slotValidationError,
    openAvailabilityDialog,
    addLocalSlot,
    saveAvailability,
  }
}