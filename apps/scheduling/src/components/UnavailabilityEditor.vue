<template>
  <v-card class="rounded-lg">
    <v-toolbar density="comfortable" color="surface" class="border-b">
      <v-icon color="primary" class="mr-2">mdi-calendar-remove</v-icon>
      <span class="text-subtitle-1 font-weight-bold">Unavailability — {{ lecturerName }}</span>
      <v-chip
        size="small"
        variant="tonal"
        :color="entries.length > 0 ? 'warning' : 'success'"
        class="ml-3 font-weight-bold"
      >
        {{ entries.length === 0 ? 'fully available' : `${entries.length} block(s)` }}
      </v-chip>
      <v-spacer />
      <v-autocomplete
        v-model="copyFromId"
        :items="copySourceItems"
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
      />
      <v-btn
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-content-copy"
        :disabled="!copyFromId || copying"
        :loading="copying"
        @click="copyFrom"
      >
        Copy
      </v-btn>
    </v-toolbar>

    <v-card-text class="pt-4">
      <template v-if="entries.length === 0">
        <div class="text-center py-4 text-medium-emphasis">
          <v-icon size="32" class="mb-2">mdi-calendar-check</v-icon>
          <div>No blocks defined — the lecturer is treated as available in all semester timeslots.</div>
        </div>
      </template>

      <v-list v-else density="compact" class="border rounded-md mb-3">
        <v-list-item v-for="(entry, i) in sortedEntries" :key="entryKey(entry, i)">
          <template #prepend>
            <v-icon color="warning">{{ entry.kind === 'weekly_recurring' ? 'mdi-calendar-week' : 'mdi-calendar-today' }}</v-icon>
          </template>
          <v-list-item-title class="font-weight-medium">
            {{ entryTitle(entry) }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ entrySubtitle(entry) }}
            <span v-if="entry.note" class="ml-2 font-italic">· {{ entry.note }}</span>
          </v-list-item-subtitle>
          <template #append>
            <v-btn
              v-if="canEdit"
              icon
              size="small"
              variant="text"
              color="error"
              @click="entries.splice(entryIndex(entry), 1)"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </v-list>

      <template v-if="canEdit">
        <v-divider class="my-2" />
        <v-tabs v-model="entryTab" color="primary" density="compact" class="mb-3">
          <v-tab value="weekly" prepend-icon="mdi-calendar-week" text="Weekly recurring" />
          <v-tab value="date" prepend-icon="mdi-calendar-today" text="Individual date" />
        </v-tabs>

        <v-window v-model="entryTab">
          <v-window-item value="weekly">
            <div class="d-flex flex-wrap ga-3 align-center">
              <div class="d-flex flex-wrap ga-1">
                <v-checkbox
                  v-for="day in weekdayOptions"
                  :key="day.value"
                  v-model="weeklyDays[day.value]"
                  :label="day.short"
                  color="primary"
                  density="compact"
                  hide-details
                  class="mr-2 weekday-check"
                />
              </div>
            </div>
            <div class="d-flex flex-wrap ga-3 align-center mt-3">
              <v-switch
                v-model="weeklyWholeDay"
                color="primary"
                density="compact"
                hide-details
                label="Whole day"
                class="mr-2"
              />
              <template v-if="!weeklyWholeDay">
                <v-text-field v-model="weeklyStart" label="From" type="time" density="compact" variant="outlined" hide-details style="max-width: 140px" />
                <v-text-field v-model="weeklyEnd" label="Until" type="time" density="compact" variant="outlined" hide-details style="max-width: 140px" />
              </template>
              <v-text-field
                v-model="entryNote"
                label="Note (optional)"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 260px"
                class="mr-2"
              />
              <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" :disabled="selectedDays.length === 0" @click="addWeekly">
                Add
              </v-btn>
            </div>
          </v-window-item>

          <v-window-item value="date">
            <div class="d-flex flex-wrap ga-3 align-center">
              <v-text-field v-model="dateValue" label="Date" type="date" density="compact" variant="outlined" hide-details style="max-width: 180px" />
              <v-switch
                v-model="dateWholeDay"
                color="primary"
                density="compact"
                hide-details
                label="Whole day"
                class="mr-2"
              />
              <template v-if="!dateWholeDay">
                <v-text-field v-model="dateStart" label="From" type="time" density="compact" variant="outlined" hide-details style="max-width: 140px" />
                <v-text-field v-model="dateEnd" label="Until" type="time" density="compact" variant="outlined" hide-details style="max-width: 140px" />
              </template>
              <v-text-field
                v-model="entryNote"
                label="Note (optional)"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 260px"
                class="mr-2"
              />
              <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" :disabled="!dateValue" @click="addDate">
                Add
              </v-btn>
            </div>
          </v-window-item>
        </v-window>
        <div v-if="validationError" class="text-error text-caption mt-2">{{ validationError }}</div>
      </template>
    </v-card-text>

    <v-divider />
    <v-card-actions class="pa-4" v-if="canEdit">
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="emit('cancel')">Cancel</v-btn>
      <v-btn color="primary" variant="flat" :loading="saving" @click="save">Save</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SchedulingLecturer, UnavailabilityEntry, UnavailabilityKind } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'

const props = defineProps<{
  lecturer: SchedulingLecturer | null
  /** All lecturers for the copy source list. */
  lecturers: SchedulingLecturer[]
  /** Whether the current user may edit this lecturer's unavailability. */
  canEdit: boolean
}>()

const emit = defineEmits<{
  (e: 'changed'): void
  (e: 'cancel'): void
}>()

interface WorkingEntry extends UnavailabilityEntry {
  kind: UnavailabilityKind
}

const entries = ref<WorkingEntry[]>([])
const entryTab = ref('weekly')

const copyFromId = ref<string | null>(null)
const copying = ref(false)
const saving = ref(false)
const validationError = ref('')

const entryNote = ref('')
const weeklyDays = ref<Record<WeekdayKey, boolean>>({ monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: false, sunday: false })
const weeklyWholeDay = ref(true)
const weeklyStart = ref('08:00')
const weeklyEnd = ref('17:00')
const dateWholeDay = ref(true)
const dateValue = ref('')
const dateStart = ref('08:00')
const dateEnd = ref('17:00')

type WeekdayKey = NonNullable<UnavailabilityEntry['weekday']>

const lecturerName = computed(() => props.lecturer?.name ?? '')

const weekdayOptions: Array<{ title: string; short: string; value: WeekdayKey }> = [
  { title: 'Monday', short: 'Mon', value: 'monday' },
  { title: 'Tuesday', short: 'Tue', value: 'tuesday' },
  { title: 'Wednesday', short: 'Wed', value: 'wednesday' },
  { title: 'Thursday', short: 'Thu', value: 'thursday' },
  { title: 'Friday', short: 'Fri', value: 'friday' },
  { title: 'Saturday', short: 'Sat', value: 'saturday' },
  { title: 'Sunday', short: 'Sun', value: 'sunday' },
]

const selectedDays = computed(() =>
  weekdayOptions.filter(d => weeklyDays.value[d.value]).map(d => d.value),
)

const copySourceItems = computed(() =>
  props.lecturers
    .filter(l => props.lecturer && l.id !== props.lecturer.id && l.unavailabilityCount > 0 && l.unavailabilityCount !== props.lecturer.unavailabilityCount)
    .map(l => ({ title: `${l.name} (${l.unavailabilityCount} blocks)`, value: l.id })),
)

const sortedEntries = computed(() => {
  const dayOrder = new Map(weekdayOptions.map((d, i) => [d.value, i]))
  return [...entries.value].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'weekly_recurring' ? -1 : 1
    if (a.kind === 'weekly_recurring' && b.kind === 'weekly_recurring') {
      return (dayOrder.get(a.weekday as WeekdayKey) ?? 0) - (dayOrder.get(b.weekday as WeekdayKey) ?? 0)
    }
    return (a.date ?? '').localeCompare(b.date ?? '')
  })
})

function entryKey(entry: WorkingEntry, _i: number): string {
  return `${entry.kind}:${entry.weekday ?? ''}:${entry.date ?? ''}:${entry.startTime ?? ''}:${entry.endTime ?? ''}:${_i}`
}

function entryIndex(entry: WorkingEntry): number {
  return entries.value.findIndex(e =>
    e.kind === entry.kind
    && e.weekday === entry.weekday
    && e.date === entry.date
    && e.startTime === entry.startTime
    && e.endTime === entry.endTime
    && e.note === entry.note,
  )
}

function entryTitle(entry: WorkingEntry): string {
  if (entry.kind === 'weekly_recurring') {
    const day = weekdayOptions.find(d => d.value === entry.weekday)?.title ?? entry.weekday
    return `Every ${day}`
  }
  const d = entry.date ? new Date(`${entry.date}T00:00:00`) : null
  const formatted = d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    : entry.date
  return String(formatted)
}

function entrySubtitle(entry: WorkingEntry): string {
  const window = entry.startTime && entry.endTime ? `${entry.startTime} – ${entry.endTime}` : 'whole day'
  return entry.kind === 'weekly_recurring' ? window : window
}

// Load entries when the lecturer changes.
watch(
  () => props.lecturer?.id,
  async (id) => {
    entries.value = []
    validationError.value = ''
    copyFromId.value = null
    if (!id || !props.lecturer) return
    if (!props.canEdit) {
      // Read-only still loads for display.
    }
    try {
      const loaded = await api.listUnavailability(id)
      entries.value = loaded.map(e => ({ ...e, kind: e.kind as UnavailabilityKind }))
    } catch (err: any) {
      setError(err.message || 'Failed to load unavailability')
    }
  },
  { immediate: true },
)

function setError(message: string): void {
  validationError.value = message
}

function addWeekly(): void {
  validationError.value = ''
  if (selectedDays.value.length === 0) {
    validationError.value = 'Pick at least one weekday.'
    return
  }
  const start = weeklyWholeDay.value ? null : weeklyStart.value
  const end = weeklyWholeDay.value ? null : weeklyEnd.value
  if (start && end && end <= start) {
    validationError.value = 'End time must be after start time.'
    return
  }
  for (const day of selectedDays.value) {
    const duplicate = entries.value.some(e => e.kind === 'weekly_recurring' && e.weekday === day && e.startTime === start && e.endTime === end && (e.note ?? '') === entryNote.value.trim())
    if (!duplicate) {
      entries.value.push({ kind: 'weekly_recurring', weekday: day, date: null, startTime: start, endTime: end, note: entryNote.value.trim() })
    }
  }
  entryNote.value = ''
}

function addDate(): void {
  validationError.value = ''
  if (!dateValue.value) {
    validationError.value = 'Pick a date.'
    return
  }
  const start = dateWholeDay.value ? null : dateStart.value
  const end = dateWholeDay.value ? null : dateEnd.value
  if (start && end && end <= start) {
    validationError.value = 'End time must be after start time.'
    return
  }
  const duplicate = entries.value.some(
    e => e.kind === 'individual_date' && e.date === dateValue.value && e.startTime === start && e.endTime === end && (e.note ?? '') === entryNote.value.trim(),
  )
  if (duplicate) {
    validationError.value = 'This entry already exists.'
    return
  }
  entries.value.push({ kind: 'individual_date', weekday: null, date: dateValue.value, startTime: start, endTime: end, note: entryNote.value.trim() })
  entryNote.value = ''
}

async function copyFrom(): Promise<void> {
  const sourceId = copyFromId.value
  if (!sourceId || copying.value) return
  copying.value = true
  validationError.value = ''
  try {
    const sourceEntries = await api.listUnavailability(sourceId)
    entries.value = sourceEntries.map(e => ({ ...e, kind: e.kind as UnavailabilityKind }))
  } catch (err: any) {
    setError(err.message || 'Failed to load source unavailability')
  } finally {
    copying.value = false
  }
}

async function save(): Promise<void> {
  if (!props.lecturer) return
  saving.value = true
  validationError.value = ''
  try {
    await api.setUnavailability(props.lecturer.id, entries.value)
    emit('changed')
  } catch (err: any) {
    setError(err.message || 'Failed to save unavailability')
  } finally {
    saving.value = false
  }
}

defineExpose({ reload: () => { /* handled by watcher on lecturer change */ } })
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.weekday-check {
  min-width: 64px;
}
</style>