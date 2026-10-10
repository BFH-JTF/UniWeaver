<template>
  <v-dialog :model-value="modelValue" max-width="720" scrollable persistent @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-shield-lock-outline" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">
          Restrictions — {{ owner?.name || '…' }}
        </v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Apply to this {{ tableLabel }} and everything it contains.
        </v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" @click="close" />
        </template>
      </v-card-item>

      <v-card-text class="pa-4 pa-sm-6">
        <div v-if="loading" class="text-caption text-medium-emphasis">Loading…</div>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          Failed to load restrictions: {{ error }}
        </v-alert>

        <template v-if="!loading">
          <!-- Own restrictions -->
          <h3 class="text-subtitle-2 font-weight-bold mb-2">Restrictions of this {{ tableLabel }}</h3>
          <v-list density="compact" class="py-0">
            <v-list-item v-for="r in ownRestrictions" :key="r.id" class="px-0">
              <template #prepend>
                <v-icon size="small" class="mr-2" :color="r.enabled ? 'primary' : 'grey'">
                  {{ specFor(r.ruleType)?.icon || 'mdi-shield-outline' }}
                </v-icon>
              </template>
              <v-list-item-title class="text-body-2">
                {{ specFor(r.ruleType)?.label || r.ruleType }}
                <v-chip size="x-small" :color="priorityColor(r.weight)" variant="tonal" class="ml-1">
                  {{ priorityLabel(r.weight) || `P${r.weight}` }}
                </v-chip>
                <v-chip v-if="!r.enabled" size="x-small" variant="tonal" class="ml-1">disabled</v-chip>
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">{{ paramsSummary(r) }}</v-list-item-subtitle>
              <template #append>
                <v-btn icon variant="text" size="small" @click="startEdit(r)">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent">Edit</v-tooltip>
                </v-btn>
                <v-btn icon variant="text" size="small" color="error" @click="handleRemove(r)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent">Delete</v-tooltip>
                </v-btn>
              </template>
            </v-list-item>
            <div v-if="ownRestrictions.length === 0" class="text-caption text-medium-emphasis">
              No restrictions defined here yet.
            </div>
          </v-list>

          <template v-if="canEdit">
            <v-divider class="my-4" />

            <!-- Add / edit editor -->
            <h3 class="text-subtitle-2 font-weight-bold mb-2">
              {{ editingId ? 'Edit restriction' : 'Add restriction' }}
            </h3>
            <v-select
              v-model="form.ruleType"
              :items="catalogSelectItems"
              :disabled="!!editingId"
              label="Rule"
              placeholder="Select a rule…"
              variant="outlined"
              density="compact"
              class="mb-1"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps">
                  <template #prepend>
                    <v-icon size="small" class="me-2">
                      {{ (item as any).raw?.icon || 'mdi-shield-outline' }}
                    </v-icon>
                  </template>
                  <template #append>
                    <v-chip
                      size="x-small"
                      :color="(item as any).raw?.category === 'hard' ? 'error' : 'warning'"
                      variant="tonal"
                    >
                      {{ (item as any).raw?.category === 'hard' ? 'must' : 'soft' }}
                    </v-chip>
                  </template>
                </v-list-item>
              </template>
            </v-select>
            <p v-if="activeSpec" class="text-caption text-medium-emphasis mb-3">
              {{ activeSpec.description }}
            </p>

            <template v-if="activeSpec">
              <div
                v-for="param in activeSpec.params"
                :key="param.key"
                class="mb-3"
              >
                <div class="text-caption text-medium-emphasis mb-1">{{ param.label }}</div>
                <v-select
                  v-if="param.type === 'weekdayArray'"
                  v-model="(form.params[param.key] as Weekday[] | undefined)"
                  :items="weekdayOptions"
                  label="Weekdays"
                  multiple
                  chips
                  closable-chips
                  variant="outlined"
                  density="compact"
                  hide-details
                />
                <v-select
                  v-else-if="param.type === 'phaseArray'"
                  v-model="(form.params[param.key] as DayPhase[] | undefined)"
                  :items="phaseOptions"
                  label="Phases"
                  multiple
                  chips
                  closable-chips
                  variant="outlined"
                  density="compact"
                  hide-details
                />
                <v-select
                  v-else-if="param.type === 'timeslotArray'"
                  v-model="(form.params[param.key] as string[] | undefined)"
                  :items="timeslotOptions"
                  label="Slot start times"
                  multiple
                  chips
                  closable-chips
                  variant="outlined"
                  density="compact"
                  hide-details
                  :no-data-text="timeslotOptions.length === 0 ? 'No timeslots defined on any semester yet' : ''"
                />
                <v-select
                  v-else-if="param.type === 'buildingArray'"
                  v-model="(form.params[param.key] as string[] | undefined)"
                  :items="buildingOptions"
                  label="Buildings"
                  multiple
                  chips
                  closable-chips
                  variant="outlined"
                  density="compact"
                  hide-details
                  :no-data-text="buildingOptions.length === 0 ? 'No buildings defined on any location yet' : ''"
                />
                <v-select
                  v-else-if="param.type === 'roomArray'"
                  v-model="(form.params[param.key] as string[] | undefined)"
                  :items="roomOptions"
                  item-title="title"
                  item-value="value"
                  label="Rooms"
                  multiple
                  chips
                  closable-chips
                  variant="outlined"
                  density="compact"
                  hide-details
                  :no-data-text="roomOptions.length === 0 ? 'No rooms defined yet' : ''"
                />
                <v-select
                  v-else-if="param.type === 'moduleArray'"
                  v-model="(form.params[param.key] as string[] | undefined)"
                  :items="moduleOptions"
                  item-title="title"
                  item-value="value"
                  label="Modules"
                  multiple
                  chips
                  closable-chips
                  variant="outlined"
                  density="compact"
                  hide-details
                  :no-data-text="moduleOptions.length === 0 ? 'No other modules defined yet' : ''"
                />
                <div v-else-if="param.type === 'dateArray'">
                  <div class="d-flex flex-wrap ga-2 mb-2">
                    <v-chip
                      v-for="(d, idx) in dateList"
                      :key="`${d}-${idx}`"
                      closable
                      size="small"
                      @click:close="dateList.splice(idx, 1); syncDatesFromList()"
                    >
                      {{ d }}
                    </v-chip>
                  </div>
                  <v-date-input
                    v-model="pickedDate"
                    label="Add date"
                    variant="outlined"
                    density="compact"
                    hide-details
                    @update:model-value="addPickedDate"
                  />
                </div>
                <v-select
                  v-else-if="param.type === 'singleWeekday'"
                  v-model="form.params[param.key]"
                  :items="weekdayOptions"
                  label="Weekday"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
                <v-select
                  v-else-if="param.type === 'choice'"
                  v-model="form.params[param.key]"
                  :items="choiceOptions(param)"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  hide-details
                />
                <v-text-field
                  v-else-if="param.type === 'number'"
                  v-model.number="form.params[param.key]"
                  type="number"
                  min="0"
                  variant="outlined"
                  density="compact"
                  hide-details
                  :placeholder="param.required ? '' : 'optional'"
                />
              </div>

              <v-row dense class="align-center">
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="form.weight"
                    :items="priorityOptions"
                    item-title="label"
                    item-value="value"
                    label="Priority"
                    hint="How strictly the solver must honor this rule"
                    persistent-hint
                    variant="outlined"
                    density="compact"
                  >
                    <template #item="{ props: itemProps, item }">
                      <v-list-item v-bind="itemProps">
                        <template #append>
                          <v-chip size="x-small" :color="(item as any).raw?.color" variant="tonal">
                            {{ (item as any).raw?.value }}
                          </v-chip>
                        </template>
                      </v-list-item>
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12" sm="6" class="mt-4">
                  <v-switch
                    v-model="form.enabled"
                    label="Enabled"
                    color="primary"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
            </template>

            <div class="d-flex ga-2 mt-4">
              <v-btn color="primary" variant="flat" :disabled="!canSubmit" @click="handleSave">
                {{ editingId ? 'Save' : 'Add' }}
              </v-btn>
              <v-btn v-if="editingId" variant="text" @click="cancelEdit">Cancel</v-btn>
            </div>
          </template>

          <template v-if="inherited.length > 0">
            <v-divider class="my-4" />
            <h3 class="text-subtitle-2 font-weight-bold mb-2">Inherited restrictions</h3>
            <p class="text-caption text-medium-emphasis mb-2">
              These apply automatically through parent entities and can only be changed there.
            </p>
            <v-list density="compact" class="py-0">
              <v-list-item v-for="r in inherited" :key="r.id" class="px-0">
                <template #prepend>
                  <v-icon size="small" class="mr-2" :color="r.enabled ? 'grey-darken-1' : 'grey-lighten-1'">
                    {{ specFor(r.ruleType)?.icon || 'mdi-shield-outline' }}
                  </v-icon>
                </template>
                <v-list-item-title class="text-body-2 text-medium-emphasis">
                  {{ specFor(r.ruleType)?.label || r.ruleType }}
                  <v-chip size="x-small" :color="priorityColor(r.weight)" variant="tonal" class="ml-1">
                    {{ priorityLabel(r.weight) || `P${r.weight}` }}
                  </v-chip>
                  <v-chip v-if="!r.enabled" size="x-small" variant="tonal" class="ml-1">disabled</v-chip>
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ paramsSummary(r) }} · inherited from {{ r.inheritedFrom?.name || r.inheritedFrom?.id }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </template>
          <template v-else>
            <v-divider class="my-4" />
            <p class="text-caption text-medium-emphasis mb-2">
              No restrictions are inherited from parent entities (departments, programs, degrees).
            </p>
          </template>
        </template>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  RESTRICTION_CATALOG,
  RESTRICTION_TYPES,
  RESTRICTION_GROUPS,
  WEEKDAYS,
  PHASE_BOUNDARIES,
  DAY_PHASES,
  PRIORITY_LEVELS,
  DEFAULT_PRIORITY,
  priorityLabel,
  validateRestrictionParams,
} from '@uniweaver/shared'
import type { EntityRestriction, EffectiveRestriction, DayPhase, Weekday, RestrictionParamSpec } from '@uniweaver/shared'
import { useRestrictions } from '@/composables/useRestrictions'
import type { RestrictionsOwner } from '@/composables/useRestrictions'
import { useAuthStore } from '@/stores/auth'
import { useCurriculumStore } from '@/stores/curriculum'

const props = defineProps<{
  modelValue: boolean
  owner: RestrictionsOwner | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'changed'): void
}>()

const auth = useAuthStore()
const curriculum = useCurriculumStore()
const {
  loading,
  error,
  fetchRestrictions,
  fetchEffectiveRestrictions,
  addRestriction,
  updateRestriction,
  removeRestriction,
} = useRestrictions()

const ownRestrictions = ref<EntityRestriction[]>([])
const inherited = ref<EffectiveRestriction[]>([])
const editingId = ref<string | null>(null)
const dateList = ref<string[]>([])
const pickedDate = ref<string | null>(null)

const form = ref<{ ruleType: string; params: Record<string, unknown>; enabled: boolean; weight: number }>(
  emptyForm(),
)

const TABLE_LABELS: Record<string, string> = {
  curriculums: 'curriculum',
  departments: 'department',
  programs: 'program',
  degrees: 'degree',
  modules: 'module',
  classes: 'class',
  class_entities: 'class',
}

const tableLabel = computed(() => TABLE_LABELS[props.owner?.table ?? ''] ?? 'entity')
const canEdit = computed(() => auth.isAdmin || !!props.owner?._canEdit)

const specFor = (ruleType: string) => RESTRICTION_TYPES[ruleType] ?? null

interface CatalogSelectItem {
  type?: 'subheader'
  title?: string
  value?: string
  icon?: string
  category?: string
}

/**
 * Flat item list for the rule picker: group subheaders followed by the
 * catalog entries of that group. Vuetify renders items with
 * type: 'subheader' as group titles.
 */
const catalogSelectItems = computed<CatalogSelectItem[]>(() => {
  const items: CatalogSelectItem[] = []
  for (const group of RESTRICTION_GROUPS) {
    const entries = RESTRICTION_CATALOG.filter(r => r.group === group)
    if (entries.length === 0) continue
    items.push({ type: 'subheader', title: group })
    for (const r of entries) {
      items.push({
        title: r.label,
        value: r.value,
        icon: r.icon,
        category: r.category,
      })
    }
  }
  return items
})

const activeSpec = computed(() => (form.value.ruleType ? specFor(form.value.ruleType) : null))

const weekdayOptions = WEEKDAYS.map(w => ({ title: (w[0] ?? '').toUpperCase() + w.slice(1), value: w }))

const phaseOptions = DAY_PHASES.map(p => ({ title: PHASE_BOUNDARIES[p].label, value: p }))

// ── Reference data (loaded lazily so dynamic param options are available) ───

const timeslotOptions = computed(() => {
  const merged = new Set<string>()
  for (const sem of curriculum.semesters ?? []) {
    for (const t of sem.slotStartTimes ?? []) merged.add(t)
  }
  return [...merged].sort()
})

const buildingOptions = computed(() => {
  const merged = new Set<string>()
  for (const loc of curriculum.locations ?? []) {
    if (loc.building && loc.building.trim()) merged.add(loc.building.trim())
  }
  return [...merged].sort()
})

const roomOptions = computed(() =>
  (curriculum.rooms ?? [])
    .filter(r => r.id || r.name)
    .map(r => {
      const id = r.id || ''
      const loc = curriculum.locations?.find(l => l.id === r.locationId)
      const place = loc ? ` (${loc.name || loc.building})` : ''
      return { title: `${r.name || r.roomNumber || id}${place}`, value: id }
    })
    .filter(o => o.value),
)

const moduleOptions = computed(() =>
  (curriculum.modules ?? [])
    .filter(m => m.id && m.id !== ownerModuleId.value)
    .map(m => ({
      title: m.code ? `${m.code} — ${m.name || m.id}` : (m.name || m.id),
      value: m.id!,
    })),
)

const ownerModuleId = computed(() => (props.owner?.table === 'modules' ? props.owner.id : ''))

async function loadReferenceData() {
  try {
    if (!curriculum.semesters?.length) await curriculum.fetchSemesters()
    if (!curriculum.locations?.length) await curriculum.fetchLocations()
    if (!curriculum.rooms?.length) await curriculum.fetchRooms()
    if (!curriculum.modules?.length) await curriculum.fetchModules()
  } catch {
    // Reference data only decorates restriction params (human-readable
    // names, room/location pickers); the dialog still works without it.
  }
}

function choiceOptions(param: RestrictionParamSpec): { title: string; value: string }[] {
  return (param.options ?? []).map(o => ({ title: o.label, value: o.value }))
}

// Human-readable name lookup for ids stored in params.
function moduleNameFor(id: unknown): string {
  const key = String(id)
  const mod = curriculum.modules?.find(m => m.id === key)
  if (!mod) return key
  return mod.code ? `${mod.code} — ${mod.name || key}` : (mod.name || key)
}

function roomNameFor(id: unknown): string {
  const key = String(id)
  const room = curriculum.rooms?.find(r => r.id === key)
  if (!room) return key
  const loc = curriculum.locations?.find(l => l.id === room.locationId)
  const place = loc ? ` (${loc.name || loc.building})` : ''
  return `${room.name || room.roomNumber || key}${place}`
}

const canSubmit = computed(() => {
  if (!form.value.ruleType) return false
  return validateRestrictionParams(form.value.ruleType, form.value.params) === null
})

function emptyForm() {
  return { ruleType: '', params: {} as Record<string, unknown>, enabled: true, weight: DEFAULT_PRIORITY }
}

const priorityOptions = PRIORITY_LEVELS.map(l => ({ label: `${l.value} · ${l.label}`, value: l.value, color: l.color }))

/** Vuetify color for a stored priority level. */
function priorityColor(weight: number): string {
  return PRIORITY_LEVELS.find(l => l.value === weight)?.color ?? 'grey'
}

function paramsSummary(r: EntityRestriction): string {
  const spec = specFor(r.ruleType)
  if (!spec) return Object.entries(r.params ?? {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  return spec.params
    .map(p => {
      const value = (r.params ?? {})[p.key]
      if (value === undefined || value === '' || value === null) {
        return p.type === 'number' && (r.params ?? {})[p.key] === 0 ? `${p.label}: 0` : ''
      }
      switch (p.type) {
        case 'phaseArray': {
          const pretty = (value as unknown[]).map(v => PHASE_BOUNDARIES[v as DayPhase]?.label ?? v)
          return `${p.label}: ${pretty.join(', ')}`
        }
        case 'roomArray':
          return `${p.label}: ${(value as unknown[]).map(roomNameFor).join(', ')}`
        case 'moduleArray':
          return `${p.label}: ${(value as unknown[]).map(moduleNameFor).join(', ')}`
        case 'choice':
          return `${p.label}: ${choiceOptions(p).find(o => o.value === String(value))?.title ?? String(value)}`
        default:
          if (Array.isArray(value)) {
            return `${p.label}: ${value.map(v => String(v)).join(', ')}`
          }
          return `${p.label}: ${String(value)}`
      }
    })
    .filter(Boolean)
    .join(' · ')
}

async function load() {
  if (!props.owner) return
  ownRestrictions.value = await fetchRestrictions(props.owner)
  const effective = await fetchEffectiveRestrictions(props.owner)
  // Split effective list into own (no inheritedFrom) and inherited entries.
  inherited.value = effective.filter(r => r.inheritedFrom)
}

function startEdit(r: EntityRestriction) {
  editingId.value = r.id
  form.value = {
    ruleType: r.ruleType,
    params: JSON.parse(JSON.stringify(r.params ?? {})),
    enabled: r.enabled,
    weight: r.weight || DEFAULT_PRIORITY,
  }
  const dates = (form.value.params['dates'] as string[] | undefined) ?? []
  dateList.value = [...dates]
}

function cancelEdit() {
  editingId.value = null
  form.value = emptyForm()
  dateList.value = []
}

function addPickedDate() {
  const d = pickedDate.value
  if (!d) return
  const iso = typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10)
  if (!dateList.value.includes(iso)) dateList.value.push(iso)
  pickedDate.value = null
  form.value.params['dates'] = [...dateList.value]
}
// keep the dateList in sync into params whenever a chip is removed
function syncDatesFromList() {
  form.value.params['dates'] = [...dateList.value]
}

async function handleSave() {
  if (!props.owner || !canSubmit.value) return
  const payload = {
    ruleType: form.value.ruleType,
    params: JSON.parse(JSON.stringify(form.value.params)),
    enabled: form.value.enabled,
    weight: form.value.weight,
  }
  const saved = editingId.value
    ? await updateRestriction(props.owner, { id: editingId.value, ...payload } as EntityRestriction)
    : await addRestriction(props.owner, payload)
  if (saved) {
    cancelEdit()
    await load()
    emit('changed')
  }
}

async function handleRemove(r: EntityRestriction) {
  if (!props.owner) return
  const ok = await removeRestriction(props.owner, r.id)
  if (ok) {
    if (editingId.value === r.id) cancelEdit()
    await load()
    emit('changed')
  }
}

function close() {
  cancelEdit()
  emit('update:modelValue', false)
}

watch(() => props.modelValue, val => {
  if (val) {
    cancelEdit()
    void load()
    void loadReferenceData()
  }
})
</script>