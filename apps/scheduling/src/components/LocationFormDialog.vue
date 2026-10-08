<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500" persistent>
    <v-card class="rounded-lg">
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon start color="primary">mdi-map-marker-outline</v-icon>
        <span class="text-h6 font-weight-bold">{{ isEdit ? 'Edit Location' : 'Add Location' }}</span>
      </v-card-title>
      <v-divider />
      <v-card-text class="pt-4">
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field v-model="location.name" label="Name *" :rules="[v => !!v || 'Name is required']" class="mb-3" />
          <v-combobox
            v-model="location.campus"
            :items="campusSuggestions"
            label="Campus"
            clearable
            class="mb-3"
          />
          <v-combobox
            v-model="location.building"
            :items="buildingSuggestions"
            label="Building *"
            :rules="[v => !!v || 'Building is required']"
            clearable
            class="mb-3"
          />
          <v-combobox
            v-model="location.address"
            :items="addressSuggestions"
            label="Address"
            clearable
            class="mb-3"
          />
          <div class="d-flex ga-3 align-center">
            <v-text-field v-model="latInput" label="Latitude" type="number" class="flex-1-1" />
            <v-text-field v-model="lngInput" label="Longitude" type="number" class="flex-1-1" />
            <v-tooltip activator="parent" location="top" :disabled="lookupEnabled">
              Enter an address first
            </v-tooltip>
            <v-btn
              icon
              variant="tonal"
              color="primary"
              :disabled="!lookupEnabled"
              @click="mapPickerOpen = true"
            >
              <v-icon>mdi-map-search</v-icon>
              <v-tooltip activator="parent" location="top" :disabled="!lookupEnabled">
                Pick position on map
              </v-tooltip>
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>

    <MapPickerDialog
      v-model="mapPickerOpen"
      :query="mapQuery"
      :initial-lat="initialLat"
      :initial-lng="initialLng"
      @picked="applyPicked"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SchedulerLocation } from '@uniweaver/shared'
import MapPickerDialog from './MapPickerDialog.vue'

const props = defineProps<{
  modelValue: boolean
  locationData?: SchedulerLocation
  /** Existing locations for dropdown suggestions on campus/building/address. */
  locations?: SchedulerLocation[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [location: SchedulerLocation]
}>()

const isEdit = computed(() => !!props.locationData?.id)

const formRef = ref()
const location = ref<SchedulerLocation>(emptyLocation())
const mapPickerOpen = ref(false)

function emptyLocation(): SchedulerLocation {
  return { id: '', name: '', campus: '', building: '', address: '' }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    location.value = props.locationData
      ? JSON.parse(JSON.stringify(props.locationData))
      : emptyLocation()
  }
})

const latInput = computed({
  get: () => location.value.latitude != null ? String(location.value.latitude) : '',
  set: (v: string) => { location.value.latitude = v ? Number(v) : undefined },
})

const lngInput = computed({
  get: () => location.value.longitude != null ? String(location.value.longitude) : '',
  set: (v: string) => { location.value.longitude = v ? Number(v) : undefined },
})

// ------------------------------------------------------------------ suggestions
function distinctSuggestions(field: 'campus' | 'building' | 'address'): string[] {
  const values = new Set<string>()
  for (const l of props.locations ?? []) {
    const raw = l[field]
    if (typeof raw === 'string' && raw.trim()) values.add(raw.trim())
  }
  const current = String(location.value[field] ?? '').trim()
  if (current && !values.has(current)) values.add(current)
  return Array.from(values).sort((a, b) => a.localeCompare(b))
}

const campusSuggestions = computed(() => distinctSuggestions('campus'))
const buildingSuggestions = computed(() => distinctSuggestions('building'))
const addressSuggestions = computed(() => distinctSuggestions('address'))

// ------------------------------------------------------------------ map lookup
const lookupEnabled = computed(() => {
  // Active once any address-ish text is entered, or when coordinates exist
  // (re-centering on the saved position is always useful).
  if (location.value.latitude != null && location.value.longitude != null) return true
  return !!(location.value.address || '').trim() || !!(location.value.building || '').trim()
})

const mapQuery = computed(() => ({
  address: String(location.value.address ?? ''),
  building: String(location.value.building ?? ''),
  campus: String(location.value.campus ?? ''),
}))

const initialLat = computed(() => location.value.latitude)
const initialLng = computed(() => location.value.longitude)

function applyPicked(lat: number, lng: number): void {
  location.value.latitude = round6(lat)
  location.value.longitude = round6(lng)
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  emit('save', JSON.parse(JSON.stringify(location.value)))
  emit('update:modelValue', false)
}
</script>