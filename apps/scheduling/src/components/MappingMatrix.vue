<template>
  <v-card class="rounded-lg elevation-1">
    <v-toolbar density="comfortable" color="surface" class="matrix-toolbar border-b">
      <v-icon color="primary" class="mr-2">mdi-grid-large</v-icon>
      <span class="text-subtitle-1 font-weight-bold">Matrix</span>
      <v-chip size="small" variant="tonal" color="primary" class="ml-3 font-weight-bold">
        {{ lecturers.length }} lecturers × {{ visibleColumnCount }} modules
      </v-chip>

      <v-spacer />

      <v-text-field
        v-model="search"
        label="Search lecturers or modules"
        prepend-inner-icon="mdi-magnify"
        clearable
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 280px"
        class="mr-3"
      />
      <v-select
        v-model="departmentFilter"
        :items="departmentItems"
        label="Department"
        clearable
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 220px"
        class="mr-3"
      />
      <v-switch
        v-model="showGapsOnly"
        color="primary"
        density="compact"
        hide-details
        label="Gaps only"
      />
    </v-toolbar>

    <div class="matrix-scroll" @pointerleave="cancelDrag">
      <div class="matrix-row matrix-header-row">
        <div class="cell corner-cell" />
        <template v-for="group in visibleGroups" :key="group.key">
          <div
            class="cell group-header"
            :style="{ '--group-color': group.color }"
            :title="`${group.label} — click to ${group.collapsed ? 'expand' : 'collapse'}`"
            @click="toggleGroup(group.key)"
          >
            <v-icon size="13">{{ group.collapsed ? 'mdi-chevron-right' : 'mdi-chevron-down' }}</v-icon>
            <span class="truncate">{{ group.label }}</span>
            <span class="text-caption">({{ group.totalColumns }})</span>
          </div>
        </template>
      </div>

      <template v-for="row in rows" :key="row.lecturer.id">
        <div v-if="row.rendered" class="matrix-row" :class="{ 'row-gap': row.isRowEmpty }">
          <div class="cell row-header" :title="row.lecturer.name">
            <span class="truncate">{{ row.lecturer.name }}</span>
          </div>
          <template v-for="group in visibleGroups" :key="group.key">
            <div
              v-for="col in group.columns"
              :key="col.id"
              class="cell data-cell"
              :class="{
                'cell-on': pairSet.has(lkey(row.lecturer.id, col.id)),
                'col-gap': col.isColumnEmpty,
                'row-gap-cell': row.isRowEmpty,
                'in-drag': isDragging && inDragRange(row.index, col.index),
              }"
              :title="titleFor(row.lecturer, col)"
              @pointerdown.prevent="startDrag(row.lecturer.id, col.id)"
              @pointerenter="dragEnter(row.lecturer.id, col.id)"
              @pointerup="endDrag($event)"
            />
          </template>
        </div>
      </template>

      <div v-if="rows.length === 0" class="text-center pa-8 text-medium-emphasis">
        <v-icon size="40" class="mb-2">mdi-grid-off</v-icon>
        <div>No lecturers match the current filters.</div>
      </div>
    </div>

    <div class="d-flex align-center pa-2 px-4 text-caption text-medium-emphasis legend">
      <span class="mr-4 legend-item"><span class="swatch swatch-on" /> assigned</span>
      <span class="mr-4 legend-item"><span class="swatch swatch-gap" /> no modules / no lecturers</span>
      <v-spacer />
      <span>Click or drag to toggle cells · click a program header to collapse it</span>
    </div>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarAction ? 8000 : 3000">
      {{ snackbarText }}
      <template v-if="snackbarAction" #actions>
        <v-btn variant="text" color="white" @click="snackbarAction(); snackbar = false">Undo</v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MappingData, MappingPairPatch, MappingLecturer, MappingModule } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'

const props = defineProps<{ mapping: MappingData }>()

const ROW_WINDOW = 80

const search = ref('')
const departmentFilter = ref<string | null>(null)
const showGapsOnly = ref(false)
const collapsedGroups = ref(new Set<string>())

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')
const snackbarAction = ref<(() => void) | null>(null)
const undoStack = ref<Array<{ label: string; pairs: MappingPairPatch[] }>>([])

// ------------------------------------------------------------------ indexes
const pairSet = computed(() => {
  const keys = new Set<string>()
  for (const p of props.mapping.pairs) keys.add(lkey(p.lecturerId, p.moduleId))
  return keys
})

const byLecturer = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const p of props.mapping.pairs) {
    const set = map.get(p.lecturerId) ?? new Set<string>()
    set.add(p.moduleId)
    map.set(p.lecturerId, set)
  }
  return map
})

const byModule = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const p of props.mapping.pairs) {
    const set = map.get(p.moduleId) ?? new Set<string>()
    set.add(p.lecturerId)
    map.set(p.moduleId, set)
  }
  return map
})

const programById = computed(() => new Map(props.mapping.programs.map(p => [p.id, p])))
const departmentById = computed(() => new Map(props.mapping.departments.map(d => [d.id, d])))

const lecturers = computed(() =>
  props.mapping.lecturers.map(l => ({
    ...l,
    departmentName: l.departmentId ? departmentById.value.get(l.departmentId)?.name ?? '' : '',
  })),
)

function lkey(lecturerId: string, moduleId: string): string {
  return `${lecturerId}\n${moduleId}`
}

// ------------------------------------------------------------------ columns (program groups)
interface Column {
  id: string
  index: number
  label: string
  isColumnEmpty: boolean
}

interface ColumnGroup {
  key: string
  label: string
  color: string
  columns: Column[]
  totalColumns: number
  collapsed: boolean
}

const DEPT_COLORS = ['#0B5DBA', '#2E7D32', '#EF6C00', '#6A1B9A', '#C62828', '#00838F', '#5D4037', '#4A148C']

const departmentItems = computed(() => props.mapping.departments.map(d => ({ title: d.name, value: d.id })))

const deptOrder = computed(() => new Map(props.mapping.departments.map((d, i) => [d.id, i])))

const allGroups = computed<ColumnGroup[]>(() => {
  // Column order: departments (filtered) -> programs -> modules
  const departments = departmentFilter.value
    ? props.mapping.departments.filter(d => d.id === departmentFilter.value)
    : props.mapping.departments

  const columnGroups: Array<{ dept: string | null; programName: string; modules: MappingModule[] }> = []

  for (const dept of departments) {
    const programIds = dept.programIds
    const programs = programIds
      .map(id => programById.value.get(id))
      .filter((p): p is MappingData['programs'][number] => !!p)

    const programList = programs.length > 0
      ? programs
      // Department w/o programs: synthetic group with its modules (via degrees)
      : [{ id: '', name: dept.name, departmentIds: [dept.id], curriculumId: '' }]

    for (const program of programList) {
      const moduleDegreeIds = new Set(
        props.mapping.degrees
          .filter(g => g.programIds.includes(program.id))
          .flatMap(g => g.programIds.includes(program.id) ? [g.id] : []),
      )
      void moduleDegreeIds
      // Modules whose degree belongs to this program
      const degreeIdsOfProgram = props.mapping.degrees
        .filter(g => g.programIds.includes(program.id))
        .map(g => g.id)
      const mods = props.mapping.modules.filter(m => m.degreeIds.some(id => degreeIdsOfProgram.includes(id)))
      if (mods.length === 0) continue
      columnGroups.push({
        dept: program.departmentIds.length > 0 ? program.departmentIds[0]! : dept.id,
        programName: program.id ? program.name : `${dept.name} (no program)`,
        modules: mods,
      })
    }
  }

  const groups: ColumnGroup[] = []
  let colIndex = 0
  for (const [gi, cg] of columnGroups.entries()) {
    const dept = cg.dept ? departmentById.value.get(cg.dept) : undefined
    const deptIdx = cg.dept ? deptOrder.value.get(cg.dept) ?? gi : gi
    const color = DEPT_COLORS[deptIdx % DEPT_COLORS.length]!
    const columns: Column[] = cg.modules.map(m => {
      const c: Column = {
        id: m.id,
        index: colIndex++,
        label: m.code ? `${m.code} — ${m.name}` : m.name,
        isColumnEmpty: (byModule.value.get(m.id) ?? new Set()).size === 0,
      }
      return c
    })
    // When collapsed, show first few columns as a teaser; the full count stays visible.
    const shown = collapsedGroups.value.has(cg.programName) ? columns.slice(0, 5) : columns
    groups.push({
      key: cg.programName,
      label: dept ? `${dept.name} / ${cg.programName}` : cg.programName,
      color,
      columns: shown,
      totalColumns: columns.length,
      collapsed: collapsedGroups.value.has(cg.programName),
    })
  }
  return groups
})

const visibleGroups = computed(() => allGroups.value.filter(g => g.columns.length > 0))
const visibleColumnCount = computed(() => visibleGroups.value.reduce((sum, g) => sum + g.columns.length, 0))

// ------------------------------------------------------------------ rows (lecturers)
interface Row {
  lecturer: MappingLecturer
  index: number
  isRowEmpty: boolean
  rendered: boolean
}

const rows = computed<Row[]>(() => {
  const q = (search.value || '').trim().toLowerCase()
  const all = props.mapping.lecturers
  const result: Row[] = all.map((lecturer, index) => {
    const modules = byLecturer.value.get(lecturer.id) ?? new Set<string>()
    return { lecturer, index, isRowEmpty: modules.size === 0, rendered: false }
  })

  // Apply column-space filter: a lecturer must have an assignment inside the
  // currently visible columns to survive "gaps only" logic meaningfully.
  let filtered = result.filter(r => {
    if (showGapsOnly.value) {
      const assigned = Array.from(byLecturer.value.get(r.lecturer.id) ?? new Set<string>())
      const hasVisible = assigned.some(moduleId => visibleGroups.value.some(g => g.columns.some(c => c.id === moduleId)))
      if (hasVisible) return false
    }
    return true
  })

  if (q) {
    filtered = filtered.filter(r => {
      const name = r.lecturer.name.toLowerCase()
      const dept = r.lecturer.departmentName.toLowerCase()
      // Also allow module-code search: lecturers who have that module
      const moduleHit = Array.from(byLecturer.value.get(r.lecturer.id) ?? new Set<string>()).some(mid => {
        const m = props.mapping.modules.find(x => x.id === mid)
        return !!m && (`${m.code} ${m.name}`.toLowerCase().includes(q))
      })
      return name.includes(q) || dept.includes(q) || moduleHit
    })
  }

  // Row windowing: render at most ROW_WINDOW rows at a time; simple top-window
  // is sufficient at this scale and keeps the DOM small.
  for (const r of filtered) r.rendered = r.index < ROW_WINDOW
  return filtered
})

// ------------------------------------------------------------------ drag toggling
interface DragState {
  startRow: number
  startCol: number
  rows: Set<number>
  cols: Set<number>
  active: boolean
}

const isDragging = ref(false)
const dragRange = ref<DragState | null>(null)
const pendingToggleValue = ref<0 | 1>(0)

function startDrag(lecturerId: string, moduleId: string): void {
  const row = rows.value.find(r => r.lecturer.id === lecturerId)
  const col = visibleGroups.value.flatMap(g => g.columns).find(c => c.id === moduleId)
  if (!row || !col) return
  const on = pairSet.value.has(lkey(lecturerId, moduleId))
  pendingToggleValue.value = on ? 0 : 1
  dragRange.value = {
    startRow: row.index,
    startCol: col.index,
    rows: new Set([row.index]),
    cols: new Set([col.index]),
    active: false,
  }
  isDragging.value = true
  window.addEventListener('pointerup', onWindowPointerUp, { once: true })
}

function dragEnter(lecturerId: string, moduleId: string): void {
  const state = dragRange.value
  if (!isDragging.value || !state) return
  const row = rows.value.find(r => r.lecturer.id === lecturerId)
  const col = visibleGroups.value.flatMap(g => g.columns).find(c => c.id === moduleId)
  if (!row || !col) return
  state.active = true
  const r0 = Math.min(state.startRow, row.index)
  const r1 = Math.max(state.startRow, row.index)
  const c0 = Math.min(state.startCol, col.index)
  const c1 = Math.max(state.startCol, col.index)
  state.rows = new Set()
  state.cols = new Set()
  for (let i = r0; i <= r1; i++) state.rows.add(i)
  for (let i = c0; i <= c1; i++) state.cols.add(i)
}

function inDragRange(rowIndex: number, colIndex: number): boolean {
  const state = dragRange.value
  if (!isDragging.value || !state) return false
  return state.rows.has(rowIndex) && state.cols.has(colIndex)
}

function endDrag(_event: Event): void {
  // Actual commit happens in onWindowPointerUp for reliability.
}

function onWindowPointerUp(): void {
  const state = dragRange.value
  isDragging.value = false
  dragRange.value = null
  if (!state) return

  const rowIndices = Array.from(state.rows)
  const colIndices = Array.from(state.cols)
  const allColumns = new Map<number, string>()
  for (const g of visibleGroups.value) {
    for (const c of g.columns) allColumns.set(c.index, c.id)
  }
  const allRows = new Map<number, string>()
  for (const r of rows.value) allRows.set(r.index, r.lecturer.id)

  const diff: MappingPairPatch[] = []
  for (const ri of rowIndices) {
    const lecturerId = allRows.get(ri)
    if (!lecturerId) continue
    for (const ci of colIndices) {
      const moduleId = allColumns.get(ci)
      if (!moduleId) continue
      diff.push({ lecturerId, moduleId, value: pendingToggleValue.value })
    }
  }
  if (diff.length === 0) return
  const isRange = diff.length > 1
  applyDiff(isRange ? `Drag range (${diff.length} cells)` : 'Toggle cell', diff)
}

function cancelDrag(): void {
  if (!isDragging.value) return
  isDragging.value = false
  dragRange.value = null
}

function titleFor(lecturer: MappingLecturer, col: Column): string {
  const on = pairSet.value.has(lkey(lecturer.id, col.id))
  return `${lecturer.name} · ${col.label} — ${on ? 'assigned' : 'click to assign'}`
}

// ------------------------------------------------------------------ apply + undo
function showSnackbar(text: string, color: string, action: (() => void) | null = null): void {
  snackbarText.value = text
  snackbarColor.value = color
  snackbarAction.value = action
  snackbar.value = true
}

function setPairsLocal(next: Set<string>): void {
  const pairs: Array<{ lecturerId: string; moduleId: string }> = []
  for (const key of next) {
    const idx = key.indexOf('\n')
    const lecturerId = key.slice(0, idx)
    const moduleId = key.slice(idx + 1)
    if (lecturerId && moduleId) pairs.push({ lecturerId, moduleId })
  }
  props.mapping.pairs.splice(0, props.mapping.pairs.length, ...pairs)
}

async function applyDiff(label: string, diff: MappingPairPatch[]): Promise<void> {
  const snapshot = new Set(pairSet.value)
  const next = new Set(snapshot)
  for (const d of diff) {
    const key = lkey(d.lecturerId, d.moduleId)
    if (d.value === 1) next.add(key)
    else next.delete(key)
  }
  setPairsLocal(next)
  try {
    await api.setMappingPairs(diff)
    undoStack.value.push({ label, pairs: diff })
    if (undoStack.value.length > 50) undoStack.value.shift()
    if (diff.length > 10) {
      showSnackbar(
        `${diff.length} cells updated`,
        'success',
        () => undoLast({ label, pairs: diff }),
      )
    }
  } catch (err: any) {
    setPairsLocal(snapshot)
    showSnackbar(err.message || 'Failed to save changes', 'error')
  }
}

async function undoLast(entry: { label: string; pairs: MappingPairPatch[] }): Promise<void> {
  const inverse: MappingPairPatch[] = entry.pairs.map(p => ({
    lecturerId: p.lecturerId,
    moduleId: p.moduleId,
    value: p.value === 1 ? 0 : 1,
  }))
  const snapshot = new Set(pairSet.value)
  const next = new Set(snapshot)
  for (const d of inverse) {
    const key = lkey(d.lecturerId, d.moduleId)
    if (d.value === 1) next.add(key)
    else next.delete(key)
  }
  setPairsLocal(next)
  try {
    await api.setMappingPairs(inverse)
    undoStack.value = undoStack.value.filter(e => e !== entry)
    showSnackbar(`Undone: ${entry.label}`, 'info')
  } catch (err: any) {
    setPairsLocal(snapshot)
    showSnackbar(err.message || 'Undo failed', 'error')
  }
}

function toggleGroup(key: string): void {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}
</script>

<style scoped>
.matrix-toolbar {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.matrix-scroll {
  overflow: auto;
  max-height: calc(100vh - 360px);
  min-height: 360px;
  position: relative;
}

.matrix-row {
  display: grid;
  grid-template-columns: 220px var(--column-track, 44px);
  grid-auto-flow: column;
  grid-auto-columns: 44px;
}

/* Header row + first column stick */
.matrix-header-row {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--v-theme-surface);
}

.cell {
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  min-width: 0;
}

.corner-cell {
  position: sticky;
  left: 0;
  z-index: 4;
  background: var(--v-theme-surface);
}

.row-header {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--v-theme-surface);
  padding: 4px 8px;
  font-size: 12px;
  display: flex;
  align-items: center;
  max-width: 220px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--group-color, #0B5DBA);
  background: color-mix(in srgb, var(--group-color, #0B5DBA) 8%, var(--v-theme-surface));
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  border-top: 3px solid var(--group-color, #0B5DBA);
}

.data-cell {
  height: 28px;
  background: var(--v-theme-surface-bright);
  cursor: pointer;
}

.data-cell.cell-on {
  background: #2E7D32;
}

.data-cell.cell-on:hover {
  background: #1B5E20;
}

.data-cell.col-gap:not(.cell-on) {
  background: rgba(198, 40, 40, 0.10);
}

.row-gap .data-cell:not(.cell-on) {
  background: rgba(198, 40, 40, 0.10);
}

.data-cell.in-drag {
  outline: 2px solid rgba(242, 169, 0, 0.9);
  outline-offset: -2px;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-item { display: inline-flex; align-items: center; }
.swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  margin-right: 4px;
  border: 1px solid rgba(0, 0, 0, 0.15);
}
.swatch-on { background: #2E7D32; }
.swatch-gap { background: rgba(198, 40, 40, 0.25); }
</style>