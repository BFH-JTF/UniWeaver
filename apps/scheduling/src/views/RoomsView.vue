<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon color="primary" size="36" class="mr-3">mdi-door-open</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Rooms</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Manage rooms, locations, and availability</p>
      </div>
    </div>

    <v-alert
      v-if="!auth.canSchedule"
      type="info"
      variant="tonal"
      icon="mdi-eye-outline"
      class="mb-4"
    >
      You have read-only access. Scheduling administrators and global administrators can edit rooms and availability.
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>
    <v-alert v-if="successMsg" type="success" variant="tonal" class="mb-4" closable @click:close="successMsg = ''">
      {{ successMsg }}
    </v-alert>

    <v-card class="rounded-lg elevation-1">
      <v-toolbar density="comfortable" color="surface" class="border-b">
        <v-icon color="primary" class="mr-2">mdi-door-open</v-icon>
        <span class="text-subtitle-1 font-weight-bold">Rooms</span>
        <v-chip color="primary" variant="tonal" size="small" class="ml-3 font-weight-bold">
          {{ filteredRooms.length }} of {{ rooms.length }} rooms
        </v-chip>
        <v-spacer />
        <v-text-field
          v-model="search"
          label="Search rooms"
          prepend-inner-icon="mdi-magnify"
          clearable
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 280px"
          class="mr-3"
        />
        <template v-if="canEdit">
          <v-btn color="secondary" variant="tonal" prepend-icon="mdi-map-marker-plus" class="mr-2" @click="openLocationDialog()">
            Add Location
          </v-btn>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="openRoomDialog()">
            Add Room
          </v-btn>
        </template>
      </v-toolbar>

      <v-data-table
        :headers="headers"
        :items="filteredRooms"
        :loading="loading"
        hover
        items-per-page="15"
      >
        <template #item.name="{ item }">
          <div class="font-weight-medium">{{ item.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ roomTypeLabel(item.roomType) }}</div>
        </template>
        <template #item.location="{ item }">
          <span v-if="item.locationName || item.locationBuilding">
            {{ item.locationName }}<span v-if="item.locationBuilding" class="text-medium-emphasis"> · {{ item.locationBuilding }}</span>
          </span>
          <span v-else class="text-caption text-medium-emphasis font-italic">—</span>
        </template>
        <template #item.room="{ item }">
          Floor {{ item.floor }}, {{ item.roomNumber }}
        </template>
        <template #item.capacity="{ item }">
          {{ item.capacity }}
        </template>
        <template #item.equipmentSummary="{ item }">
          <div class="d-flex flex-wrap ga-1" style="max-width: 320px">
            <v-icon v-if="item.equipment?.projector" size="16" class="mr-1"><v-tooltip activator="parent">Projector</v-tooltip>mdi-projector</v-icon>
            <v-icon v-if="item.equipment?.smartboard" size="16" class="mr-1"><v-tooltip activator="parent">Smartboard</v-tooltip>mdi-monitor-dashboard</v-icon>
            <v-icon v-if="item.equipment?.whiteboards" size="16" class="mr-1"><v-tooltip activator="parent">Whiteboards</v-tooltip>mdi-whiteboard</v-icon>
            <v-icon v-if="item.equipment?.blackboard" size="16" class="mr-1"><v-tooltip activator="parent">Blackboard</v-tooltip>mdi-square-outline</v-icon>
            <v-icon v-if="item.equipment?.flipchart" size="16" class="mr-1"><v-tooltip activator="parent">Flipchart</v-tooltip>mdi-easel</v-icon>
            <v-icon v-if="item.equipment?.microphone" size="16" class="mr-1"><v-tooltip activator="parent">Microphone</v-tooltip>mdi-microphone</v-icon>
            <v-icon v-if="item.equipment?.speakers" size="16" class="mr-1"><v-tooltip activator="parent">Speakers</v-tooltip>mdi-speaker</v-icon>
            <v-icon v-if="item.equipment?.document_camera" size="16" class="mr-1"><v-tooltip activator="parent">Document camera</v-tooltip>mdi-camera</v-icon>
            <v-icon v-if="item.equipment?.lectern" size="16" class="mr-1"><v-tooltip activator="parent">Lectern</v-tooltip>mdi-podium</v-icon>
            <v-icon v-if="item.equipment?.lecture_capture" size="16" class="mr-1"><v-tooltip activator="parent">Lecture capture</v-tooltip>mdi-record</v-icon>
            <v-icon v-if="item.equipment?.streaming_camera?.available" size="16" class="mr-1"><v-tooltip activator="parent">Streaming camera</v-tooltip>mdi-webcam</v-icon>
            <v-icon v-if="item.equipment?.video_conferencing" size="16" class="mr-1"><v-tooltip activator="parent">Video conferencing</v-tooltip>mdi-monitor-multiple</v-icon>
            <v-icon v-if="item.connectivity?.wifi" size="16" class="mr-1"><v-tooltip activator="parent">Wi-Fi</v-tooltip>mdi-wifi</v-icon>
            <v-icon v-if="item.connectivity?.wired_network" size="16" class="mr-1"><v-tooltip activator="parent">Wired network</v-tooltip>mdi-ethernet</v-icon>
            <v-icon v-if="item.accessibility?.step_free_access" size="16" class="mr-1"><v-tooltip activator="parent">Step-free access</v-tooltip>mdi-wheelchair-accessibility</v-icon>
          </div>
        </template>
        <template #item.availabilityCount="{ item }">
          <v-chip
            size="small"
            :variant="item.availabilityCount > 0 ? 'tonal' : 'outlined'"
            :color="item.availabilityCount > 0 ? 'success' : 'warning'"
            class="font-weight-bold"
          >
            {{ item.availabilityCount }}
          </v-chip>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end ga-1">
            <v-btn
              icon
              variant="text"
              size="small"
              color="primary"
              @click="openAvailabilityDialog(item)"
            >
              <v-icon>mdi-clock-time-eight</v-icon>
              <v-tooltip activator="parent">Availability ({{ item.availabilityCount }} slots)</v-tooltip>
            </v-btn>
            <template v-if="canEdit">
              <v-btn icon variant="text" size="small" color="primary" @click="openRoomDialog(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit room</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" color="error" @click="askDeleteRoom(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete room</v-tooltip>
              </v-btn>
            </template>
            <template v-else>
              <v-btn icon variant="text" size="small" @click="openRoomDialog(item)">
                <v-icon>mdi-eye</v-icon>
                <v-tooltip activator="parent">View room</v-tooltip>
              </v-btn>
            </template>
          </div>
        </template>
        <template #no-data>
          <div class="text-center py-6 text-medium-emphasis">
            <v-icon size="32" class="mb-2">mdi-door-closed</v-icon>
            <div>No rooms yet{{ search ? ' matching your search' : '' }}.</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <v-card class="rounded-lg elevation-1 mt-4">
      <v-toolbar density="comfortable" color="surface" class="border-b">
        <v-icon color="secondary" class="mr-2">mdi-map-marker-outline</v-icon>
        <span class="text-subtitle-1 font-weight-bold">Locations</span>
        <v-chip color="secondary" variant="tonal" size="small" class="ml-3 font-weight-bold">
          {{ filteredLocations.length }} of {{ locations.length }} locations
        </v-chip>
        <v-spacer />
        <v-text-field
          v-model="locationSearch"
          label="Search locations"
          prepend-inner-icon="mdi-magnify"
          clearable
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 280px"
          class="mr-3"
        />
        <v-btn
          v-if="canEdit"
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-map-marker-plus"
          @click="openLocationDialog()"
        >
          Add Location
        </v-btn>
      </v-toolbar>

      <v-data-table
        :headers="locationHeaders"
        :items="filteredLocations"
        :loading="loading"
        hover
        items-per-page="10"
      >
        <template #item.location="{ item }">
          <div class="font-weight-medium">{{ item.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ item.campus }}</div>
        </template>
        <template #item.building="{ item }">
          {{ item.building }}
        </template>
        <template #item.address="{ item }">
          <span v-if="item.address">{{ item.address }}</span>
          <span v-else class="text-caption text-medium-emphasis font-italic">—</span>
        </template>
        <template #item.coordinates="{ item }">
          <span v-if="item.latitude != null && item.longitude != null" class="text-caption">
            {{ item.latitude.toFixed(5) }}, {{ item.longitude.toFixed(5) }}
          </span>
          <span v-else class="text-caption text-medium-emphasis font-italic">not set</span>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex justify-end ga-1">
            <template v-if="canEdit">
              <v-btn icon variant="text" size="small" color="primary" @click="openLocationDialog(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit location</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" color="error" @click="askDeleteLocation(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete location</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-caption text-medium-emphasis">read-only</span>
          </div>
        </template>
        <template #no-data>
          <div class="text-center py-6 text-medium-emphasis">
            <v-icon size="32" class="mb-2">mdi-map-marker-off-outline</v-icon>
            <div>No locations yet. Rooms work without a location reference.</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <RoomFormDialog
      v-model="roomDialogOpen"
      :room-data="editingRoom"
      :locations="locations"
      @save="saveRoom"
      @create-location="createInlineLocation"
    />

    <LocationFormDialog
      v-model="locationDialogOpen"
      :location-data="editingLocation"
      :locations="locations"
      @save="saveLocation"
    />

    <v-dialog v-model="deleteDialogOpen" max-width="440px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="d-flex align-center py-3 px-4">
          <v-icon start color="error">mdi-alert-outline</v-icon>
          <span class="text-h6 font-weight-bold">Delete {{ deleteKind === 'room' ? 'Room' : 'Location' }}</span>
        </v-card-title>
        <v-card-text>
          Delete <strong>{{ deleteTargetName }}</strong>?
          <div v-if="deleteKind === 'room'" class="text-caption text-medium-emphasis mt-1">
            Its availability slots will be removed as well. This cannot be undone.
          </div>
          <div v-else class="text-caption text-medium-emphasis mt-1">
            Rooms in this location keep their data but lose the location reference.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="deleting" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="availabilityDialogOpen" max-width="760px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="d-flex align-center py-3 px-4">
          <v-icon start color="primary">mdi-clock-time-eight</v-icon>
          <span class="text-h6 font-weight-bold">Availability — {{ availabilityRoomName }}</span>
          <v-spacer />
          <v-autocomplete
            v-model="copyAvailabilityFromId"
            :items="copyAvailabilitySourceItems"
            label="Copy from..."
            item-title="title"
            item-value="value"
            clearable
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 320px"
            class="mr-2"
            :disabled="!canEdit"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps">
                <template #append>
                  <v-chip
                    v-if="copySourceSlotCount(item.value)"
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    class="ml-2 font-weight-bold"
                  >
                    {{ copySourceSlotCount(item.value) }}
                  </v-chip>
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-content-copy"
            :disabled="!copyAvailabilityFromId || copyingAvailability"
            :loading="copyingAvailability"
            @click="copyAvailability"
          >
            Copy
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text class="pt-4">
          <v-alert
            v-if="!canEdit"
            type="info"
            density="compact"
            variant="tonal"
            class="mb-3"
          >
            Read-only view.
          </v-alert>

          <template v-if="availabilitySlots.length === 0">
            <div class="text-center py-4 text-medium-emphasis">
              <v-icon size="32" class="mb-2">mdi-clock-remove-outline</v-icon>
              <div>No availability slots defined — the room is treated as always available.</div>
            </div>
          </template>

          <v-list v-else density="compact" class="border rounded-md mb-3">
            <v-list-item v-for="(slot, i) in availabilitySlots" :key="i">
              <template #prepend>
                <v-icon color="primary"> mdi-calendar-week</v-icon>
              </template>
              <v-list-item-title class="font-weight-medium">
                {{ weekdayLabel(slot.weekday) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ slot.startTime }} – {{ slot.endTime }}
                <span v-if="slot.weekId" class="ml-2">· specific week</span>
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-if="canEdit"
                  icon
                  size="small"
                  variant="text"
                  color="error"
                  @click="availabilitySlots.splice(i, 1)"
                >
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>

          <template v-if="canEdit">
            <v-divider class="my-2" />
            <div class="text-subtitle-2 font-weight-bold mb-2 mt-2">Add slot</div>
            <div class="d-flex flex-wrap ga-3 align-center">
              <v-select
                v-model="newSlotWeekday"
                :items="weekdayOptions"
                label="Weekday"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 180px"
              />
              <v-text-field
                v-model="newSlotStart"
                label="Start"
                type="time"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 140px"
              />
              <v-text-field
                v-model="newSlotEnd"
                label="End"
                type="time"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 140px"
              />
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-plus"
                :disabled="!newSlotStart || !newSlotEnd"
                @click="addLocalSlot"
              >
                Add
              </v-btn>
            </div>
            <div v-if="slotValidationError" class="text-error text-caption mt-2">{{ slotValidationError }}</div>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" :disabled="savingAvailability" @click="availabilityDialogOpen = false">
            {{ canEdit ? 'Cancel' : 'Close' }}
          </v-btn>
          <v-btn
            v-if="canEdit"
            color="primary"
            variant="flat"
            :loading="savingAvailability"
            :disabled="slotValidationError !== ''"
            @click="saveAvailability"
          >
            Save Availability
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { SchedulerLocation, SchedulerRoom, RoomAvailabilitySlot, Weekday } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'
import { useAuthStore } from '@/stores/auth'
import RoomFormDialog from '@/components/RoomFormDialog.vue'
import LocationFormDialog from '@/components/LocationFormDialog.vue'

const auth = useAuthStore()
const canEdit = computed(() => auth.canSchedule)

const rooms = ref<SchedulerRoom[]>([])
const locations = ref<SchedulerLocation[]>([])
const loading = ref(false)
const search = ref('')
const locationSearch = ref('')
const error = ref('')
const successMsg = ref('')

const roomDialogOpen = ref(false)
const locationDialogOpen = ref(false)
const editingRoom = ref<SchedulerRoom | undefined>(undefined)
const editingLocation = ref<SchedulerLocation | undefined>(undefined)
const savingRoom = ref(false)

const deleteDialogOpen = ref(false)
const deleteKind = ref<'room' | 'location'>('room')
const deleteTargetId = ref('')
const deleteTargetName = ref('')
const deleting = ref(false)

type AvailabilitySlotInput = Array<Omit<RoomAvailabilitySlot, 'id' | 'roomId'>>

const availabilityDialogOpen = ref(false)
const availabilityRoomId = ref('')
const availabilityRoomName = ref('')
/** Local editing copy; loaded slots + newly added ones (no id/roomId yet). */
const availabilitySlots = ref<AvailabilitySlotInput>([])
const savedSlots = ref<Map<string, string>>(new Map())
const savingAvailability = ref(false)
const newSlotWeekday = ref<Weekday>('monday')
const newSlotStart = ref('08:00')
const newSlotEnd = ref('12:00')

const copyAvailabilityFromId = ref<string | null>(null)
const copyingAvailability = ref(false)
/** Slots of rooms already loaded in this dialog session (source cache). */
const availabilitySourceCache = ref<Map<string, AvailabilitySlotInput>>(new Map())

const copyAvailabilitySourceItems = computed(() =>
  rooms.value
    .filter(r => r.id !== availabilityRoomId.value && r.availabilityCount > 0)
    .map(r => ({ title: `${r.name} (${r.availabilityCount} slots)`, value: r.id })),
)

function copySourceSlotCount(roomId: string): number {
  return rooms.value.find(r => r.id === roomId)?.availabilityCount ?? 0
}

async function copyAvailability(): Promise<void> {
  const sourceRoomId = copyAvailabilityFromId.value
  if (!sourceRoomId || !canEdit.value || copyingAvailability.value) return
  copyingAvailability.value = true
  error.value = ''
  try {
    let sourceSlots = availabilitySourceCache.value.get(sourceRoomId)
    if (!sourceSlots) {
      sourceSlots = (await api.listRoomAvailability(sourceRoomId)).map(
        ({ roomId: _roomId, id: _id, ...rest }) => rest,
      )
      availabilitySourceCache.value.set(sourceRoomId, sourceSlots)
    }
    // Replace semantics (same as copying module lists): the target gets
    // exactly the source's slots; nothing is merged.
    availabilitySlots.value = [...sourceSlots]
    successMsg.value = ''
    slotValidationError.value = ''
  } catch (err: any) {
    error.value = err.message || 'Failed to load source availability'
  } finally {
    copyingAvailability.value = false
  }
}

const weekdayOptions: Array<{ title: string; value: Weekday }> = [
  { title: 'Monday', value: 'monday' },
  { title: 'Tuesday', value: 'tuesday' },
  { title: 'Wednesday', value: 'wednesday' },
  { title: 'Thursday', value: 'thursday' },
  { title: 'Friday', value: 'friday' },
  { title: 'Saturday', value: 'saturday' },
  { title: 'Sunday', value: 'sunday' },
]

const headers = computed(() => [
  { title: 'Room', key: 'name' },
  { title: 'Location', key: 'location' },
  { title: 'Floor / Number', key: 'room' },
  { title: 'Seats', key: 'capacity' },
  { title: 'Equipment', key: 'equipmentSummary', sortable: false },
  { title: 'Availability', key: 'availabilityCount' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
])

const filteredRooms = computed(() => {
  const q = (search.value || '').trim().toLowerCase()
  if (!q) return rooms.value
  return rooms.value.filter(r =>
    `${r.name} ${r.roomNumber} ${r.locationName} ${r.locationBuilding} ${r.roomType} ${r.owner}`.toLowerCase().includes(q),
  )
})

const locationHeaders = [
  { title: 'Campus', key: 'location' },
  { title: 'Building', key: 'building' },
  { title: 'Address', key: 'address' },
  { title: 'Coordinates', key: 'coordinates' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
] as const

const filteredLocations = computed(() => {
  const q = (locationSearch.value || '').trim().toLowerCase()
  if (!q) return locations.value
  return [...locations.value]
    .filter(l =>
      `${l.name} ${l.campus} ${l.building} ${l.address}`.toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
})

function roomTypeLabel(roomType: string): string {
  return roomType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function weekdayLabel(weekday: string): string {
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}

async function fetchRooms(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [roomsResult, locationsResult] = await Promise.all([api.listRooms(), api.listLocations()])
    rooms.value = roomsResult
    locations.value = locationsResult
  } catch (err: any) {
    error.value = err.message || 'Failed to load rooms'
  } finally {
    loading.value = false
  }
}

// ------------------------------------------------------------------ room dialog
function openRoomDialog(room?: SchedulerRoom): void {
  editingRoom.value = room
  roomDialogOpen.value = true
}

async function saveRoom(room: SchedulerRoom): Promise<void> {
  savingRoom.value = true
  error.value = ''
  try {
    if (room.id) {
      await api.updateRoom(room.id, room)
      successMsg.value = `Room "${room.name}" updated.`
    } else {
      const { id } = await api.createRoom(room)
      const created = { ...room, id }
      rooms.value = [...rooms.value, created].sort((a, b) => a.name.localeCompare(b.name))
      successMsg.value = `Room "${room.name}" created.`
    }
    await fetchRooms()
  } catch (err: any) {
    error.value = err.message || 'Failed to save room'
  } finally {
    savingRoom.value = false
  }
}

function askDeleteRoom(room: SchedulerRoom): void {
  deleteKind.value = 'room'
  deleteTargetId.value = room.id
  deleteTargetName.value = room.name
  deleteDialogOpen.value = true
}

function askDeleteLocation(location: SchedulerLocation): void {
  deleteKind.value = 'location'
  deleteTargetId.value = location.id
  deleteTargetName.value = location.name
  deleteDialogOpen.value = true
}

// ------------------------------------------------------------------ location dialog
function openLocationDialog(location?: SchedulerLocation): void {
  editingLocation.value = location
  locationDialogOpen.value = true
}

async function createInlineLocation(location: SchedulerLocation): Promise<void> {
  error.value = ''
  try {
    const created = await api.createLocation(location)
    locations.value = [...locations.value, created].sort((a, b) => a.name.localeCompare(b.name))
  } catch (err: any) {
    error.value = err.message || 'Failed to create location'
  }
}

async function saveLocation(location: SchedulerLocation): Promise<void> {
  error.value = ''
  try {
    if (location.id) {
      await api.updateLocation(location.id, location)
    } else {
      const created = await api.createLocation(location)
      locations.value = [...locations.value, created].sort((a, b) => a.name.localeCompare(b.name))
    }
    await fetchRooms()
  } catch (err: any) {
    error.value = err.message || 'Failed to save location'
  }
}

async function confirmDelete(): Promise<void> {
  deleting.value = true
  error.value = ''
  try {
    if (deleteKind.value === 'room') {
      await api.deleteRoom(deleteTargetId.value)
      rooms.value = rooms.value.filter(r => r.id !== deleteTargetId.value)
      successMsg.value = `Room "${deleteTargetName.value}" deleted.`
    } else {
      await api.deleteLocation(deleteTargetId.value)
      locations.value = locations.value.filter(l => l.id !== deleteTargetId.value)
      successMsg.value = `Location "${deleteTargetName.value}" deleted.`
    }
    await fetchRooms()
  } catch (err: any) {
    error.value = err.message || 'Failed to delete'
  } finally {
    deleting.value = false
    deleteDialogOpen.value = false
  }
}

// ------------------------------------------------------------------ availability
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
    } catch (err: any) {
      error.value = err.message || 'Failed to load availability'
      availabilityDialogOpen.value = false
    }
  })()
}

const slotValidationError = ref('')

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
  error.value = ''
  try {
    await api.setRoomAvailability(availabilityRoomId.value, availabilitySlots.value)
    const room = rooms.value.find(r => r.id === availabilityRoomId.value)
    if (room) room.availabilityCount = availabilitySlots.value.length
    successMsg.value = `Availability of "${availabilityRoomName.value}" saved (${availabilitySlots.value.length} slots).`
    availabilityDialogOpen.value = false
  } catch (err: any) {
    error.value = err.message || 'Failed to save availability'
  } finally {
    savingAvailability.value = false
  }
}

onMounted(() => {
  void fetchRooms()
})
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>