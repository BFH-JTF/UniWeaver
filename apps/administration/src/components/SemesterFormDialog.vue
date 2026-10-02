<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500" persistent>
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-school-outline" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">{{ isEdit ? 'Edit Semester' : 'Add Semester' }}</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Define a semester period for scheduling
        </v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" @click="close" />
        </template>
      </v-card-item>

      <v-card-text class="pa-4 pa-sm-6">
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="form.name"
            label="Name *"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'Name is required']"
            placeholder="e.g. HS2026, FS2027"
            class="mb-3"
          />

          <v-text-field
            v-model="form.startDate"
            label="Start Date *"
            type="date"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'Start date is required']"
            class="mb-3"
          />

          <v-text-field
            v-model="form.endDate"
            label="End Date *"
            type="date"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'End date is required', v => !form.startDate || v >= form.startDate || 'End date must be after start date']"
            class="mb-3"
          />

          <v-text-field
            v-model="form.code"
            label="Code"
            variant="outlined"
            density="compact"
            placeholder="e.g. HS2026"
            class="mb-3"
          />

          <v-divider class="mb-4" />
          <div class="text-subtitle-2 font-weight-bold mb-2">Timeslots</div>
          <p class="text-caption text-medium-emphasis mb-3">
            Modules may only start at these timeslot boundaries. The grid applies to every weekday.
          </p>

          <v-text-field
            v-model.number="form.slotDurationMinutes"
            label="Timeslot length (minutes) *"
            type="number"
            variant="outlined"
            density="compact"
            min="5"
            step="5"
            :rules="[
              v => (v !== undefined && v !== null && v !== '') || 'Timeslot length is required',
              v => !v || Number.isInteger(Number(v)) || 'Must be a whole number',
              v => !v || Number(v) > 0 || 'Must be greater than 0',
            ]"
            class="mb-3"
          />

          <div class="text-subtitle-2 font-weight-bold mb-2">Timeslot start points *</div>
          <div v-for="(_, idx) in form.slotStartTimes" :key="idx" class="d-flex align-center ga-2 mb-2">
            <v-text-field
              v-model="form.slotStartTimes![idx]"
              label="Start time"
              type="time"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 160px"
            />
            <v-btn icon variant="text" size="small" color="error" @click="form.slotStartTimes!.splice(idx, 1)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </div>
          <v-btn variant="tonal" prepend-icon="mdi-plus" size="small" @click="addSlotStart">
            Add Start Time
          </v-btn>

          <v-alert v-if="timeslotError" type="error" density="compact" variant="tonal" class="mt-4">
            {{ timeslotError }}
          </v-alert>
        </v-form>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">
          {{ isEdit ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Semester } from '@/stores/curriculum'
import { emptySemester } from '@/composables/useSemesters'

const props = defineProps<{
  modelValue: boolean
  semesterData: Semester | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: Semester): void
}>()

const isEdit = computed(() => !!props.semesterData?._id || !!props.semesterData?.id)

const form = ref<Semester>(JSON.parse(JSON.stringify(emptySemester)))
const formRef = ref()
const timeslotError = ref<string | null>(null)

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.semesterData) {
      form.value = JSON.parse(JSON.stringify(props.semesterData))
    } else {
      form.value = JSON.parse(JSON.stringify(emptySemester))
    }
    if (!form.value.slotStartTimes) form.value.slotStartTimes = []
    if (form.value.slotDurationMinutes === undefined || form.value.slotDurationMinutes === null) {
      form.value.slotDurationMinutes = undefined
    }
    timeslotError.value = null
  }
})

function addSlotStart() {
  if (!form.value.slotStartTimes) form.value.slotStartTimes = []
  form.value.slotStartTimes.push('')
}

function close() {
  emit('update:modelValue', false)
}

/** Normalizes a time input to HH:MM; returns null when empty/invalid. */
function normalizeTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value?.trim() ?? '')
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Minutes since midnight for a HH:MM string. */
function toMinutes(time: string): number {
  const parts = time.split(':')
  const h = Number(parts[0] ?? 0)
  const m = Number(parts[1] ?? 0)
  return h * 60 + m
}

function submit() {
  const duration = form.value.slotDurationMinutes
  const normalizedDuration =
    duration === undefined || duration === null || (duration as unknown) === '' ? undefined : Number(duration)

  const starts = (form.value.slotStartTimes ?? [])
    .map(t => normalizeTime(String(t)))
    .filter((t): t is string => t !== null)
  starts.sort()

  // Structural validation (blocking): duration required, at least one start
  if ((normalizedDuration === undefined || normalizedDuration === null || normalizedDuration <= 0) && starts.length > 0) {
    timeslotError.value = 'Please define the timeslot length in minutes.'
    return
  }
  if (normalizedDuration !== undefined && normalizedDuration !== null && normalizedDuration > 0 && starts.length === 0) {
    timeslotError.value = 'Please add at least one timeslot start point.'
    return
  }

  // Reject overlapping slots: consecutive starts must be at least one slot apart
  if (normalizedDuration !== undefined && normalizedDuration !== null && normalizedDuration > 0) {
    const minGap = Number(normalizedDuration)
    for (let i = 1; i < starts.length; i++) {
      const prev = starts[i - 1]
      const curr = starts[i]
      if (!prev || !curr) continue
      if (toMinutes(curr) - toMinutes(prev) < minGap) {
        timeslotError.value = `Start points ${prev} and ${curr} are closer together than the timeslot length (${minGap} min). The timeslots would overlap.`
        return
      }
    }
  }

  timeslotError.value = null
  form.value.slotDurationMinutes = normalizedDuration
  form.value.slotStartTimes = starts
  emit('save', JSON.parse(JSON.stringify(form.value)))
  close()
}
</script>