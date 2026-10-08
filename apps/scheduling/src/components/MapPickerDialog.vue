<template>
  <v-dialog :model-value="modelValue" max-width="920px" persistent>
    <v-card class="rounded-lg">
      <v-card-title class="d-flex align-center py-3 px-4">
        <v-icon start color="primary">mdi-map-search</v-icon>
        <span class="text-h6 font-weight-bold">Pick Position</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="cancel" />
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-4">
        <v-alert
          v-if="notice"
          :type="noticeType"
          density="compact"
          variant="tonal"
          class="mb-3"
        >
          {{ notice }}
        </v-alert>

        <div ref="mapEl" class="map-picker" />

        <div class="d-flex align-center mt-3 flex-wrap ga-3">
          <v-icon size="18" color="primary">mdi-crosshairs-gps</v-icon>
          <span class="text-body-2 font-weight-medium">
            {{ pickedLat != null && pickedLng != null ? `Lat ${pickedLat.toFixed(6)}, Lng ${pickedLng.toFixed(6)}` : 'Click on the map to pick a position' }}
          </span>
          <v-spacer />
          <v-btn
            variant="text"
            prepend-icon="mdi-crosshairs"
            :disabled="pickedLat == null || pickedLng == null"
            @click="locateGeocoded"
          >
            Center on address
          </v-btn>
        </div>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <span class="text-caption text-medium-emphasis mr-auto">
          Map data © OpenStreetMap contributors
        </span>
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-check"
          :disabled="pickedLat == null || pickedLng == null"
          @click="apply"
        >
          Use this position
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Leaflet's default icon detection breaks under bundlers (the img URLs are
// resolved against the bundled CSS and 404, rendering an empty marker).
// Point the default icon at the bundled asset URLs instead.
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const props = defineProps<{
  modelValue: boolean
  /** Address lines used for geocoding when no coordinates exist yet. */
  query: { address: string; building: string; campus: string }
  /** Last saved position (center + marker + "last position" fallback). */
  initialLat?: number
  initialLng?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Emitted only by "Use this position". */
  'picked': [lat: number, lng: number]
}>()

const mapEl = ref<HTMLElement | null>(null)
const pickedLat = ref<number | null>(null)
const pickedLng = ref<number | null>(null)
const notice = ref('')
const noticeType = ref<'info' | 'warning' | 'error'>('info')

let map: L.Map | null = null
let marker: L.Marker | null = null
let geocodedCenter: L.LatLngExpression | null = null
let resizeObserver: ResizeObserver | null = null
let initTimer: number | null = null

// Default: Bern, BFH area
const DEFAULT_CENTER: L.LatLngExpression = [46.948, 7.4474]
const DEFAULT_ZOOM = 12
const GEOCODE_ZOOM = 17

function close(): void {
  emit('update:modelValue', false)
}

// v-model changes in BOTH directions must drive the map lifecycle:
// init when opened (the update event alone only fires on programmatic closes),
// destroy when closed so the next open starts fresh.
watch(
  () => props.modelValue,
  (open) => {
    if (open) initMap()
    else destroyMap()
  },
)

function initMap(): void {
  pickedLat.value = null
  pickedLng.value = null
  notice.value = ''
  geocodedCenter = null

  // Let the dialog render before initializing the map.
  initTimer = window.setTimeout(() => {
    initTimer = null
    if (!mapEl.value || !props.modelValue) return
    if (map) destroyMap()

    map = L.map(mapEl.value, { zoomControl: true })

    // Vuetify animates the dialog; the panel may still be mid-transition (or
    // sized 0) when the map is created. invalidateSize whenever it grows.
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize()
    })
    resizeObserver.observe(mapEl.value)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    map.on('click', (event: L.LeafletMouseEvent) => {
      setPicked(event.latlng.lat, event.latlng.lng)
    })

    const hasSaved = props.initialLat != null && props.initialLng != null
    if (hasSaved) {
      const lat = props.initialLat as number
      const lng = props.initialLng as number
      map.setView([lat, lng], GEOCODE_ZOOM)
      setPicked(lat, lng)
      notice.value = 'Showing the last saved position. Click elsewhere to pick a new one.'
      noticeType.value = 'info'
      void geocode(false)
      return
    }

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)

    const addressQuery = composeAddressQuery()
    if (addressQuery) {
      void geocode(true)
      notice.value = 'Looking up the address...'
      noticeType.value = 'info'
    } else {
      notice.value = 'No coordinates saved. Pan to the building and click to pick a position.'
      noticeType.value = 'info'
    }
  }, 50)
}

function destroyMap(): void {
  if (initTimer != null) {
    window.clearTimeout(initTimer)
    initTimer = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (map) {
    map.remove()
    map = null
    marker = null
    geocodedCenter = null
  }
}

function composeAddressQuery(): string {
  const parts = [props.query.address, props.query.building, props.query.campus]
    .map(s => s.trim())
    .filter(Boolean)
  return parts.join(', ')
}

/**
 * Nominatim rejects over-specified queries ("street 73, Bern, Building Name, Campus Code"
 * often yields zero results). Try progressively simpler queries; the address line stays
 * intact since it usually contains the city.
 */
function geocodeCandidates(): string[] {
  const address = props.query.address.trim()
  const building = props.query.building.trim()
  const campus = props.query.campus.trim()
  const candidates = [
    [address, building, campus],
    [address, campus],
    [address, building],
    [address],
  ]
    .map(parts => parts.filter(Boolean).join(', '))
    .filter(q => q.length > 0)
  return Array.from(new Set(candidates))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

async function geocode(centerOnResult: boolean): Promise<void> {
  if (!map) return

  // Optional bias: when coordinates were saved before, prefer results near them
  // (Nominatim viewbox+bounded), preventing identical street names in other cities.
  let viewboxParam = ''
  if (props.initialLat != null && props.initialLng != null) {
    const d = 0.05 // ~5 km around the saved position
    const south = (props.initialLat - d).toFixed(4)
    const west = (props.initialLng - d).toFixed(4)
    const north = (props.initialLat + d).toFixed(4)
    const east = (props.initialLng + d).toFixed(4)
    viewboxParam = `&viewbox=${west},${south},${east},${north}&bounded=1`
  }

  let sawEmptyResult = false
  const candidates = geocodeCandidates()
  for (const [i, q] of candidates.entries()) {
    if (i > 0) await sleep(1100) // Nominatim usage policy: max 1 request/second
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}${viewboxParam}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const results: Array<{ lat: string; lon: string; display_name: string }> = await res.json()
      if (!Array.isArray(results) || results.length === 0) {
        sawEmptyResult = true
        continue
      }
      const lat = Number(results[0]!.lat)
      const lng = Number(results[0]!.lon)
      geocodedCenter = [lat, lng]
      if (centerOnResult) {
        map.setView([lat, lng], GEOCODE_ZOOM)
        setPicked(lat, lng)
        notice.value = `Showing the geocoded address (${candidates.length > 1 ? `query: "${q}"` : 'full address'}). Click elsewhere to correct it.`
        noticeType.value = 'info'
      }
      return
    } catch {
      notice.value = 'Address lookup failed (network?). Pan manually and click the building.'
      noticeType.value = 'warning'
      return
    }
  }

  if (sawEmptyResult) {
    notice.value = 'Address not found on the map. Pan manually and click the building.'
    noticeType.value = 'warning'
  }
}

function locateGeocoded(): void {
  if (geocodedCenter && map) {
    map.setView(geocodedCenter, GEOCODE_ZOOM)
  }
}

function setPicked(lat: number, lng: number): void {
  pickedLat.value = lat
  pickedLng.value = lng
  if (map) {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map)
      marker.on('dragend', () => {
        if (!marker) return
        const pos = marker.getLatLng()
        pickedLat.value = pos.lat
        pickedLng.value = pos.lng
      })
    } else {
      marker.setLatLng([lat, lng])
    }
  }
}

function apply(): void {
  if (pickedLat.value == null || pickedLng.value == null) return
  emit('picked', pickedLat.value, pickedLng.value)
  close()
}

function cancel(): void {
  close()
}

onBeforeUnmount(destroyMap)
</script>

<style scoped>
.map-picker {
  height: 440px;
  width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  z-index: 0;
}
</style>