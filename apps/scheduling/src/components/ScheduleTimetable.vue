<template>
  <div>
    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">
      {{ loadError }}
    </v-alert>

    <div v-if="loading" class="d-flex align-center py-6">
      <v-progress-circular indeterminate color="primary" size="28" class="mr-3" />
      <span class="text-medium-emphasis">Loading schedule entries...</span>
    </div>

    <div v-else-if="!entries.length" class="text-medium-emphasis py-4">
      No schedule entries available.
    </div>

    <template v-else>
      <div class="d-flex align-center mb-2">
        <v-chip variant="tonal" color="primary" size="small" prepend-icon="mdi-recycle">
          Applies to every semester week
        </v-chip>
        <v-spacer />
        <span class="text-caption text-medium-emphasis">{{ entries.length }} schedule entries</span>
      </div>

      <div class="timetable-wrap rounded-lg border">
        <table class="timetable">
          <thead>
            <tr>
              <th class="time-col">Time</th>
              <th v-for="day in WEEKDAYS" :key="day.key">{{ day.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in gridRows" :key="row.start">
              <td class="time-col text-caption text-medium-emphasis">{{ row.start }}–{{ row.end }}</td>
              <td v-for="day in WEEKDAYS" :key="day.key" class="slot-cell">
                <v-card
                  v-for="block in row.cells[day.key]"
                  :key="block.id"
                  class="entry-chip"
                  elevation="0"
                  :style="{ background: block.color, borderColor: block.border }"
                >
                  <v-tooltip activator="parent" location="top">{{ block.tooltip }}</v-tooltip>
                  <span class="entry-title">{{ block.title }}</span>
                  <span class="entry-sub">{{ block.sub }}</span>
                </v-card>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ScheduleEntryRow } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'

const WEEKDAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
] as const

const props = defineProps<{
  runId: string
  semesterId: string
}>()

const entries = ref<ScheduleEntryRow[]>([])
const loading = ref(false)
const loadError = ref('')

const DAY_COLORS = [
  { color: '#E3F2FD', border: '#90CAF9' },
  { color: '#E8F5E9', border: '#A5D6A7' },
  { color: '#FFF8E1', border: '#FFE082' },
  { color: '#F3E5F5', border: '#CE93D8' },
  { color: '#E0F7FA', border: '#80DEEA' },
  { color: '#FFEBEE', border: '#EF9A9A' },
  { color: '#F1F8E9', border: '#C5E1A5' },
] as const

interface GridRow {
  start: string
  end: string
  cells: Record<string, Array<{ id: string; title: string; sub: string; tooltip: string; color: string; border: string }>>
}

const dayStarts = computed(() =>
  [...new Set(entries.value.map((e) => e.startTime))].sort(),
)

const dayEnds = computed(() => {
  const byStart = new Map<string, number>()
  for (const e of entries.value) {
    const minutes = timeToMinutes(e.startTime) + durationOf(e)
    byStart.set(e.startTime, Math.max(byStart.get(e.startTime) ?? 0, minutes))
  }
  return byStart
})

const gridRows = computed<GridRow[]>(() => {
  const rows: GridRow[] = []
  for (const start of dayStarts.value) {
    const end = minutesToHHMM(dayEnds.value.get(start) ?? timeToMinutes(start) + 45)
    const cells: GridRow['cells'] = {}
    for (const day of WEEKDAYS) {
      cells[day.key] = entries.value
        .filter((e) => e.weekday === day.key && e.startTime === start)
        .map((e, idx) => {
          const moduleTitle = e.moduleNames?.length
            ? e.moduleNames.join(', ')
            : (e.moduleIds.map((id) => moduleLabels.value.get(id) ?? id).join(', ') || '?')
          const c = DAY_COLORS[idx % DAY_COLORS.length]!
          return {
            id: e.id,
            title: moduleTitle,
            sub: roomLabels(e),
            tooltip: fullLabel(e),
            color: c.color,
            border: c.border,
          }
        })
    }
    rows.push({ start, end, cells })
  }
  return rows
})

const moduleLabels = ref(new Map<string, string>())

function roomLabels(e: ScheduleEntryRow): string {
  return (e.roomNames?.length ? e.roomNames : e.roomIds).join(', ')
}

function fullLabel(e: ScheduleEntryRow): string {
  const modules = e.moduleNames?.length ? e.moduleNames.join(', ') : e.moduleIds.join(', ')
  const classes = e.classNames?.length ? e.classNames.join(', ') : e.classIds.join(', ')
  const lecturers = e.lecturerNames?.length ? e.lecturerNames.join(', ') : e.lecturerIds.join(', ')
  return `${modules} · ${classes} · ${roomLabels(e)} · ${lecturers}`
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function durationOf(e: ScheduleEntryRow): number {
  return timeToMinutes(e.endTime) - timeToMinutes(e.startTime)
}

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    entries.value = await api.listScheduleEntries(props.runId)
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load schedule entries'
  } finally {
    loading.value = false
  }
}

watch(() => props.runId, load)
onMounted(load)
</script>

<style scoped>
.timetable-wrap {
  overflow-x: auto;
  background: rgb(var(--v-theme-surface));
}
.timetable {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.timetable th,
.timetable td {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}
.timetable thead th {
  background: rgba(var(--v-theme-primary), 0.06);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.time-col {
  width: 92px;
  white-space: nowrap;
}
.slot-cell {
  min-width: 118px;
}
.entry-chip {
  border-radius: 6px;
  border: 1px solid;
  padding: 3px 6px;
  margin: 2px 0;
  line-height: 1.25;
  cursor: default;
}
.entry-title {
  display: block;
  font-weight: 600;
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.87);
}
.entry-sub {
  display: block;
  font-size: 10.5px;
  color: rgba(0, 0, 0, 0.6);
}
</style>