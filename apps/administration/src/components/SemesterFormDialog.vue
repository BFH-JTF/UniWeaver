<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500" persistent>
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-school-outline" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">
          {{ isEdit ? 'Edit Semester' : 'Add Semester' }}
          <CopyIdButton v-if="isEdit" :id="semesterData?._id || semesterData?.id" color="white" />
        </v-card-title>
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
        <v-btn color="primary" variant="flat" :loading="submitting" :disabled="submitting" @click="submit">
          {{ isEdit ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { validateTimeslots } from '@/composables/useSemesterTimeslots'
import CopyIdButton from '@/components/CopyIdButton.vue'
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
  submitting.value = false
  emit('update:modelValue', false)
}

const submitting = ref(false)
const formRef = ref()

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    // form-field rules (name/dates) gate the submit like in the other dialogs
    const { valid } = await formRef.value?.validate() ?? { valid: false }
    if (!valid) return
    const result = validateTimeslots(form.value.slotDurationMinutes, form.value.slotStartTimes)
    timeslotError.value = result.error
    if (result.error) return
    form.value.slotDurationMinutes = result.normalizedDuration
    form.value.slotStartTimes = result.starts
    emit('save', JSON.parse(JSON.stringify(form.value)))
  } finally {
    submitting.value = false
  }
  close()
}
</script>