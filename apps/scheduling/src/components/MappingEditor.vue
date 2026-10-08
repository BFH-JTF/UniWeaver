<template>
  <v-card class="rounded-lg elevation-1">
    <v-toolbar density="comfortable" color="surface" class="border-b">
      <v-btn-toggle v-model="mode" mandatory variant="outlined" density="comfortable" class="mr-4">
        <v-btn value="lecturer" prepend-icon="mdi-account">Lecturer-centric</v-btn>
        <v-btn value="module" prepend-icon="mdi-book-alphabet">Module-centric</v-btn>
      </v-btn-toggle>

      <v-autocomplete
        v-model="copyFromId"
        :items="copySourceItems"
        :label="copyLabel"
        item-title="name"
        item-value="id"
        clearable
        variant="outlined"
        density="comfortable"
        hide-details
        style="max-width: 280px"
        class="mr-2"
      >
        <template #prepend-inner>
          <v-icon size="18" color="primary">mdi-content-copy</v-icon>
        </template>
      </v-autocomplete>
      <v-btn
        color="secondary"
        variant="tonal"
        :disabled="!copyFromId || copyFromId === selectedId || copying"
        :loading="copying"
        @click="confirmCopy"
      >
        Copy from...
      </v-btn>

      <v-spacer />

      <v-combobox
        v-model="quickEntryCodes"
        :items="quickEntrySuggestions"
        :label="quickEntryLabel"
        multiple
        chips
        closable-chips
        variant="outlined"
        density="comfortable"
        hide-details
        clearable
        style="max-width: 420px"
        @update:model-value="onQuickEntryChanged"
      >
        <template #prepend-inner>
          <v-icon size="18" color="primary">mdi-plus-box-multiple</v-icon>
        </template>
      </v-combobox>
      <v-btn
        icon
        variant="text"
        size="small"
        :disabled="undoStack.length === 0"
        @click="undo"
      >
        <v-icon>mdi-undo</v-icon>
        <v-tooltip activator="parent">Undo last change</v-tooltip>
      </v-btn>
    </v-toolbar>

    <div class="d-flex" style="height: calc(100vh - 340px); min-height: 420px">
      <!-- Master: lecturer or module list -->
      <div class="master-pane border-e fill-height d-flex flex-column">
        <div class="pa-3 pb-0">
          <v-text-field
            v-model="masterSearch"
            :label="searchLabel"
            prepend-inner-icon="mdi-magnify"
            clearable
            density="compact"
            variant="outlined"
            hide-details
          />
          <v-checkbox
            v-model="todoFilter"
            :label="todoLabel"
            color="primary"
            density="compact"
            hide-details
            class="mt-2"
          />
        </div>
        <div class="flex-1-1 overflow-y-auto pa-2">
          <v-progress-linear v-if="applying" indeterminate color="accent" height="2" />
          <template v-if="filteredMaster.length === 0">
            <div class="text-medium-emphasis text-center pa-6">
              <v-icon size="32" class="mb-2">mdi-magnify-close</v-icon>
              <div>No matching entries</div>
            </div>
          </template>
          <v-list density="compact" nav>
            <v-list-item
              v-for="item in filteredMaster"
              :key="item.id"
              :active="item.id === selectedId"
              :title="item.name"
              :subtitle="item.subtitle"
              :class="['rounded-lg', 'ma-1', item.id === selectedId ? 'v-list-item--active' : '']"
              @click="selectedId = item.id"
            >
              <template #append>
                <v-chip
                  v-if="item.count > 0"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  class="font-weight-bold"
                >
                  {{ item.count }}
                </v-chip>
                <v-chip v-else size="x-small" variant="tonal" color="warning">0</v-chip>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </div>

      <!-- Detail: counterpart list grouped by program/degree -->
      <div class="flex-1-1 fill-height overflow-y-auto pa-4">
        <div v-if="!selectedId" class="text-center pa-10 text-medium-emphasis">
          <v-icon size="48" class="mb-3">mdi-arrow-left-circle-outline</v-icon>
          <div class="text-h6 mb-1">Select a {{ mode === 'lecturer' ? 'lecturer' : 'module' }}</div>
          <div>The mapped {{ mode === 'lecturer' ? 'modules' : 'lecturers' }} will appear here.</div>
        </div>

        <template v-else>
          <div class="d-flex align-center mb-3">
            <div>
              <div class="text-h6 font-weight-bold">{{ selectedName }}</div>
              <div class="text-caption text-medium-emphasis">{{ selectedSubtitle }}</div>
            </div>
            <v-spacer />
            <v-chip color="primary" variant="tonal" size="small" class="font-weight-bold">
              {{ detailGrouped.reduce((sum, g) => sum + g.items.length, 0) }} mapped
            </v-chip>
            <v-btn
              class="ml-2"
              color="error"
              variant="text"
              size="small"
              prepend-icon="mdi-playlist-remove"
              @click="clearAllDetail(false)"
            >
              Remove all
            </v-btn>
          </div>

          <v-alert
            v-if="detailGrouped.length === 0"
            type="info"
            variant="tonal"
            icon="mdi-information-outline"
            density="compact"
          >
            No {{ mode === 'lecturer' ? 'modules' : 'lecturers' }} mapped yet.
          </v-alert>

          <div v-for="group in detailGrouped" :key="group.key" class="mb-4">
            <div class="d-flex align-center mb-1">
              <v-icon size="16" color="primary" class="mr-2">{{ mode === 'lecturer' ? 'mdi-book-alphabet' : 'mdi-account' }}</v-icon>
              <span class="text-subtitle-2 font-weight-bold">{{ group.label }}</span>
              <v-chip size="x-small" variant="tonal" class="ml-2">{{ group.items.length }}</v-chip>
            </div>
            <div class="d-flex flex-wrap ga-2">
              <v-chip
                v-for="item in group.items"
                :key="item.id"
                closable
                color="primary"
                variant="tonal"
                :disabled="applying"
                @click:close="removeMapping(item.id)"
              >
                {{ item.label }}
              </v-chip>
            </div>
          </div>
        </template>
      </div>
    </div>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarAction ? 8000 : 3000">
      {{ snackbarText }}
      <template v-if="snackbarAction" #actions>
        <v-btn variant="text" color="white" @click="snackbarAction(); snackbar = false">Undo</v-btn>
      </template>
      <template v-else #actions>
        <v-btn icon="mdi-close" variant="text" size="small" color="white" @click="snackbar = false" />
      </template>
    </v-snackbar>

    <v-dialog v-model="copyConfirmOpen" max-width="480px">
      <v-card class="rounded-lg">
        <v-card-title class="d-flex align-center py-3 px-4">
          <v-icon start color="secondary">mdi-content-copy</v-icon>
          <span class="text-h6 font-weight-bold">Confirm copy</span>
        </v-card-title>
        <v-card-text>
          <div class="mb-2">
            Replace the {{ detailNoun }} of <strong>{{ selectedName }}</strong> with the
            {{ detailNoun }} of <strong>{{ copySourceName }}</strong>?
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ copySourceCount }} will be copied. The current selection of
            {{ selectedCount }} will be removed first.
          </div>
          <v-alert
            v-if="copySourceCount === 0"
            type="warning"
            density="compact"
            variant="tonal"
            class="mt-2"
          >
            The source list is empty — this would clear the target entirely.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="copyConfirmOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="copying" @click="executeCopy">
            Replace
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MappingData, MappingPairPatch } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'

const props = defineProps<{ mapping: MappingData }>()

type Mode = 'lecturer' | 'module'

interface UndoEntry {
  label: string
  pairs: MappingPairPatch[]
}

const mode = ref<Mode>('lecturer')
const selectedId = ref('')
const masterSearch = ref('')
const todoFilter = ref(false)

const applying = ref(false)
const undoStack = ref<UndoEntry[]>([])

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')
const snackbarAction = ref<(() => void) | null>(null)

const copyFromId = ref<string | null>(null)
const copying = ref(false)
const copyConfirmOpen = ref(false)

const quickEntryCodes = ref<string[]>([])
const lastQuickEntry = ref<string[]>([])

// ------------------------------------------------------------------ indexes
const pairSet = computed(() => {
  const keys = new Set<string>()
  for (const p of props.mapping.pairs) {
    keys.add(`${p.lecturerId}\n${p.moduleId}`)
  }
  return keys
})

const byLecturer = computed(() => {
  const map = new Map<string, string[]>()
  for (const p of props.mapping.pairs) {
    const list = map.get(p.lecturerId) ?? []
    list.push(p.moduleId)
    map.set(p.lecturerId, list)
  }
  return map
})

const byModule = computed(() => {
  const map = new Map<string, string[]>()
  for (const p of props.mapping.pairs) {
    const list = map.get(p.moduleId) ?? []
    list.push(p.lecturerId)
    map.set(p.moduleId, list)
  }
  return map
})

const degreeById = computed(() => new Map(props.mapping.degrees.map(d => [d.id, d])))
const programById = computed(() => new Map(props.mapping.programs.map(p => [p.id, p])))
const lecturerById = computed(() => new Map(props.mapping.lecturers.map(l => [l.id, l])))
const moduleById = computed(() => new Map(props.mapping.modules.map(m => [m.id, m])))

function programNameForModule(moduleId: string): string {
  const module = moduleById.value.get(moduleId)
  if (!module) return 'Unassigned'
  const degree = module.degreeIds.map(id => degreeById.value.get(id)).find(Boolean)
  const program = degree?.programIds.map(id => programById.value.get(id)).find(Boolean)
  return program?.name ?? degreesLabel(module.degreeIds) ?? 'Unassigned'
}

function degreesLabel(degreeIds: string[]): string {
  const names = degreeIds.map(id => degreeById.value.get(id)?.name).filter(Boolean)
  return names.length > 0 ? names.join(', ') : ''
}

// ------------------------------------------------------------------ master list
const searchLabel = computed(() => (mode.value === 'lecturer' ? 'Search lecturers' : 'Search modules'))
const todoLabel = computed(() =>
  mode.value === 'lecturer' ? 'Only lecturers without modules' : 'Only modules without lecturers',
)

const masterItems = computed(() => {
  if (mode.value === 'lecturer') {
    return props.mapping.lecturers.map(l => ({
      id: l.id,
      name: l.name,
      subtitle: l.departmentName || l.departmentId || '',
      count: (byLecturer.value.get(l.id) ?? []).length,
      searchText: `${l.name} ${l.departmentName}`.toLowerCase(),
    }))
  }
  return props.mapping.modules.map(m => ({
    id: m.id,
    name: m.code ? `${m.code} — ${m.name}` : m.name,
    subtitle: programNameForModule(m.id),
    count: (byModule.value.get(m.id) ?? []).length,
    searchText: `${m.code} ${m.name} ${programNameForModule(m.id)}`.toLowerCase(),
  }))
})

const filteredMaster = computed(() => {
  const q = (masterSearch.value || '').trim().toLowerCase()
  return masterItems.value.filter(item => {
    if (todoFilter.value && item.count > 0) return false
    if (!q) return true
    return item.searchText.includes(q)
  })
})

// Auto-select first item on mode switch or empty filter results.
const selected = computed(() => {
  if (mode.value === 'lecturer') return lecturerById.value.get(selectedId.value)
  return moduleById.value.get(selectedId.value)
})

const selectedName = computed(() => {
  if (mode.value === 'lecturer') return selected.value?.name ?? ''
  const m = selected.value as MappingData['modules'][number] | undefined
  return m?.code ? `${m.code} — ${m.name}` : m?.name ?? ''
})

const selectedSubtitle = computed(() => {
  if (mode.value === 'lecturer') {
    const l = selected.value as MappingData['lecturers'][number] | undefined
    return (!l || !l.departmentName) ? '' : l.departmentName
  }
  return programNameForModule(selectedId.value)
})

// ------------------------------------------------------------------ detail (grouped)
interface DetailGroup {
  key: string
  label: string
  items: Array<{ id: string; label: string }>
}

const detailNoun = computed(() => (mode.value === 'lecturer' ? 'modules' : 'lecturers'))

const selectedCount = computed(() => {
  if (mode.value === 'lecturer') return (byLecturer.value.get(selectedId.value) ?? []).length
  return (byModule.value.get(selectedId.value) ?? []).length
})

const detailGrouped = computed<DetailGroup[]>(() => {
  if (!selectedId.value) return []
  if (mode.value === 'lecturer') {
    const moduleIds = byLecturer.value.get(selectedId.value) ?? []
    return groupModules(moduleIds)
  }
  const lecturerIds = byModule.value.get(selectedId.value) ?? []
  return groupLecturers(lecturerIds)
})

function groupModules(moduleIds: string[]): DetailGroup[] {
  const groups = new Map<string, DetailGroup>()
  for (const moduleId of moduleIds) {
    const module = moduleById.value.get(moduleId)
    if (!module) continue
    const label = mode.value === 'lecturer'
      ? programNameForModule(moduleId)
      : (module.code ? (module.code.startsWith(module.name) ? module.name : `${module.code} — ${module.name}`) : module.name)
    const key = label
    const group = groups.get(key) ?? { key, label, items: [] }
    group.items.push({
      id: moduleId,
      label: module.code && module.code !== module.name ? `${module.code} ${module.name}` : module.name,
    })
    groups.set(key, group)
  }
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function groupLecturers(lecturerIds: string[]): DetailGroup[] {
  const lecturerItems = lecturerIds
    .map(lecturerId => {
      const lecturer = lecturerById.value.get(lecturerId)
      return lecturer ? { id: lecturerId, label: lecturer.name } : null
    })
    .filter((item): item is { id: string; label: string } => item !== null)
    .sort((a, b) => a.label.localeCompare(b.label))
  if (lecturerItems.length === 0) return []
  return [{ key: 'lecturers', label: 'Lecturers', items: lecturerItems }]
}

// ------------------------------------------------------------------ copy from
const copySourceItems = computed(() => {
  if (mode.value === 'lecturer') {
    return props.mapping.lecturers
      .filter(l => l.id !== selectedId.value)
      .map(l => ({ id: l.id, name: l.name }))
  }
  return props.mapping.modules
    .filter(m => m.id !== selectedId.value)
    .map(m => ({ id: m.id, name: m.code ? `${m.code} — ${m.name}` : m.name }))
})

const copyLabel = computed(() =>
  mode.value === 'lecturer' ? 'Copy modules from lecturer' : 'Copy lecturers from module',
)

const copySourceName = computed(() => {
  const id = copyFromId.value
  if (!id) return ''
  return (mode.value === 'lecturer' ? lecturerById.value.get(id)?.name : null)
    ?? (mode.value === 'module'
      ? (moduleById.value.get(id)?.code
        ? `${moduleById.value.get(id)!.code} — ${moduleById.value.get(id)!.name}`
        : moduleById.value.get(id)?.name)
      : '')
})

const copySourceCount = computed(() => {
  const id = copyFromId.value
  if (!id) return 0
  return mode.value === 'lecturer'
    ? (byLecturer.value.get(id) ?? []).length
    : (byModule.value.get(id) ?? []).length
})

// ------------------------------------------------------------------ quick entry
const quickEntryLabel = computed(() =>
  mode.value === 'lecturer' ? 'Add module codes (paste or type)' : 'Add lecturer names',
)

const quickEntrySuggestions = computed(() => {
  if (mode.value === 'lecturer') {
    return props.mapping.modules.map(m => m.code || m.name).filter(Boolean)
  }
  return props.mapping.lecturers.map(l => l.name)
})

// ------------------------------------------------------------------ actions
function showSnackbar(text: string, color: string, action: (() => void) | null = null): void {
  snackbarText.value = text
  snackbarColor.value = color
  snackbarAction.value = action
  snackbar.value = true
}

function pushUndo(entry: UndoEntry): void {
  undoStack.value.push(entry)
  if (undoStack.value.length > 50) undoStack.value.shift()
}

async function applyDiff(label: string, diff: MappingPairPatch[]): Promise<boolean> {
  // Optimistic local update
  const snapshot = new Set(pairSet.value)
  const next = new Set(snapshot)
  for (const d of diff) {
    const key = `${d.lecturerId}\n${d.moduleId}`
    if (d.value === 1) next.add(key)
    else next.delete(key)
  }
  setPairs(next)

  applying.value = true
  try {
    await api.setMappingPairs(diff)
    pushUndo({ label, pairs: diff })
    return true
  } catch (err: any) {
    // Roll back the optimistic change
    setPairs(snapshot)
    showSnackbar(err.message || 'Failed to save changes', 'error')
    return false
  } finally {
    applying.value = false
  }
}

function setPairs(next: Set<string>): void {
  // Pairs are only mutated here; the parent keeps the full data for other tabs.
  const pairs: Array<{ lecturerId: string; moduleId: string }> = []
  for (const key of next) {
    const idx = key.indexOf('\n')
    const lecturerId = key.slice(0, idx)
    const moduleId = key.slice(idx + 1)
    if (lecturerId && moduleId) pairs.push({ lecturerId, moduleId })
  }
  // eslint-disable-next-line vue/no-mutating-props
  props.mapping.pairs.splice(0, props.mapping.pairs.length, ...pairs)
}

function removeMapping(moduleId: string): void {
  if (!selectedId.value) return
  const lecturerId = selectedId.value
  applyDiff('Remove module', [{ lecturerId, moduleId, value: 0 }])
}

function clearAllDetail(isUndo: boolean): void {
  if (isUndo) return
  if (mode.value === 'lecturer') {
    const lecturerId = selectedId.value
    const mapped = byLecturer.value.get(lecturerId) ?? []
    if (mapped.length === 0) return
    applyDiff('Remove all', mapped.map(moduleId => ({ lecturerId, moduleId, value: 0 as const })))
    return
  }
  const moduleId = selectedId.value
  const mapped = byModule.value.get(moduleId) ?? []
  if (mapped.length === 0) return
  applyDiff('Remove all', mapped.map(lecturerId => ({ lecturerId, moduleId, value: 0 as const })))
}

function confirmCopy(): void {
  if (!copyFromId.value || !selectedId.value) return
  copyConfirmOpen.value = true
}

async function executeCopy(): Promise<void> {
  if (!selectedId.value || !copyFromId.value) return
  copying.value = true
  try {
    const sourceKey = mode.value === 'lecturer' ? copyFromId.value : copyFromId.value
    const targetId = selectedId.value

    const currentKeys =
      mode.value === 'lecturer'
        ? (byLecturer.value.get(targetId) ?? []).map(moduleId => ({ lecturerId: targetId, moduleId }))
        : (byModule.value.get(targetId) ?? []).map(lecturerId => ({ lecturerId, moduleId: targetId }))

    const sourceKeys =
      mode.value === 'lecturer'
        ? (byLecturer.value.get(sourceKey) ?? []).map(moduleId => ({ lecturerId: targetId, moduleId }))
        : (byModule.value.get(sourceKey) ?? []).map(lecturerId => ({ lecturerId, moduleId: targetId }))

    // Replace semantics: clear target (only where the source lacks the pair),
    // then set everything from the source.
    const sourceKeySet = new Set(sourceKeys.map(k => `${k.lecturerId}\n${k.moduleId}`))
    const diff: MappingPairPatch[] = [
      ...currentKeys
        .filter(k => !sourceKeySet.has(`${k.lecturerId}\n${k.moduleId}`))
        .map(k => ({ ...k, value: 0 as const })),
      ...sourceKeys.map(k => ({ ...k, value: 1 as const })),
    ]

    const ok = await applyDiff(`Copy from ${copySourceName.value}`, diff)
    copyConfirmOpen.value = false
    if (ok) {
      showSnackbar(`Replaced with ${sourceKeys.length} entries from ${copySourceName.value}`, 'success')
      copyFromId.value = null
    }
  } finally {
    copying.value = false
  }
}

function onQuickEntryChanged(values: unknown): void {
  const entries = Array.isArray(values) ? values.map(v => String(v)).filter(Boolean) : []
  const added = entries.filter(e => !lastQuickEntry.value.includes(e))
  lastQuickEntry.value = [...entries]

  if (added.length === 0) return

  if (mode.value === 'lecturer') {
    const lecturerId = selectedId.value
    if (!lecturerId) {
      lastQuickEntry.value = []
      quickEntryCodes.value = []
      showSnackbar('Select a lecturer first', 'error')
      return
    }
    const wanted: Array<{ id: string; raw: string } | null> = entries.map(raw => {
      const code = raw.trim().toUpperCase()
      const module = props.mapping.modules.find(
        m => (m.code || '').toUpperCase() === code || m.name.toUpperCase() === code,
      )
      return module ? { id: module.id, raw } : null
    })
    const unknown = wanted.flatMap(w => (w === null ? [String(w)] : []))
    const pairs = wanted
      .filter((w): w is { id: string; raw: string } => !!w)
      .map(w => ({ lecturerId, moduleId: w.id, value: 1 as const }))

    const existing = new Set(byLecturer.value.get(lecturerId) ?? [])
    const fresh = pairs.filter(p => !existing.has(p.moduleId))
    if (fresh.length === 0 && unknown.length > 0) {
      showSnackbar(`Unknown module codes: ${unknown.join(', ')}`, 'warning')
      return
    }
    const label = unknown.length > 0
      ? `Add ${fresh.length} via quick entry (unknown: ${unknown.join(', ')})`
      : `Quick entry: add ${fresh.length}`
    applyDiff(label, fresh)
    return
  }

  // Module-centric quick entry: match lecturer names
  const moduleId = selectedId.value
  if (!moduleId) {
    lastQuickEntry.value = []
    quickEntryCodes.value = []
    showSnackbar('Select a module first', 'error')
    return
  }
  const wantedLecturers: Array<{ id: string; raw: string } | null> = entries.map(raw => {
    const name = raw.trim().toLowerCase()
    const lecturer = props.mapping.lecturers.find(l => l.name.toLowerCase() === name)
    return lecturer ? { id: lecturer.id, raw } : null
  })
  const unknownL = wantedLecturers.flatMap(w => (w === null ? [String(w)] : []))
  const pairs = wantedLecturers
    .filter((w): w is { id: string; raw: string } => !!w)
    .map(w => ({ moduleId, lecturerId: w.id, value: 1 as const }))
  const existingL = new Set(byModule.value.get(moduleId) ?? [])
  const fresh = pairs.filter(p => !existingL.has(p.lecturerId))
  const label = unknownL.length > 0
    ? `Quick entry (unknown names: ${unknownL.join(', ')})`
    : `Quick entry: add ${fresh.length}`
  applyDiff(label, fresh)
}

function undo(): void {
  const entry = undoStack.value.pop()
  if (!entry) return
  const inverse: MappingPairPatch[] = entry.pairs.map(p => ({
    lecturerId: p.lecturerId,
    moduleId: p.moduleId,
    value: p.value === 1 ? 0 : 1,
  }))
  void api
    .setMappingPairs(inverse)
    .then(() => {
      const next = new Set(pairSet.value)
      for (const d of inverse) {
        const key = `${d.lecturerId}\n${d.moduleId}`
        if (d.value === 1) next.add(key)
        else next.delete(key)
      }
      setPairs(next)
      showSnackbar(`Undone: ${entry.label}`, 'info')
    })
    .catch((err: any) => {
      showSnackbar(err.message || 'Undo failed', 'error')
    })
}
</script>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.border-e {
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.master-pane {
  width: 320px;
  flex-shrink: 0;
}
.flex-1-1 {
  flex: 1 1 auto;
}
</style>