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
        <div v-if="error" class="text-error text-caption mb-2">{{ error }}</div>

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
                <v-chip size="x-small" :color="r.weight > 0 ? 'warning' : 'error'" variant="tonal" class="ml-1">
                  {{ r.weight > 0 ? `soft · ${r.weight}` : 'hard' }}
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
              :items="catalogItems"
              item-title="label"
              item-value="value"
              :disabled="!!editingId"
              label="Restriction type *"
              variant="outlined"
              density="compact"
              class="mb-3"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps">
                  <template #prepend>
                    <v-chip size="x-small" :color="(item as any).raw?.category === 'hard' ? 'error' : 'warning'" variant="tonal" class="me-2">
                      {{ (item as any).raw?.category }}
                    </v-chip>
                  </template>
                </v-list-item>
              </template>
            </v-select>

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
              </div>

              <v-row v-if="activeSpec.category === 'soft'" dense class="align-center">
                <v-col cols="12" sm="6">
                  <v-slider
                    v-model="form.weight"
                    :min="1"
                    :max="20"
                    :step="1"
                    label="Priority"
                    thumb-label
                    color="warning"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-switch
                    v-model="form.enabled"
                    label="Enabled"
                    color="primary"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
              <v-switch
                v-else
                v-model="form.enabled"
                label="Enabled"
                color="primary"
                density="compact"
                hide-details
              />
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
                  <v-chip size="x-small" :color="r.weight > 0 ? 'warning' : 'error'" variant="tonal" class="ml-1">
                    {{ r.weight > 0 ? `soft · ${r.weight}` : 'hard' }}
                  </v-chip>
                  <v-chip v-if="!r.enabled" size="x-small" variant="tonal" class="ml-1">disabled</v-chip>
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ paramsSummary(r) }} · inherited from {{ r.inheritedFrom?.name || r.inheritedFrom?.id }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
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
  WEEKDAYS,
  PHASE_BOUNDARIES,
  DAY_PHASES,
  DEFAULT_SOFT_WEIGHT,
  validateRestrictionParams,
} from '@uniweaver/shared'
import type { EntityRestriction, EffectiveRestriction, DayPhase, Weekday } from '@uniweaver/shared'
import { useRestrictions } from '@/composables/useRestrictions'
import type { RestrictionsOwner } from '@/composables/useRestrictions'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  modelValue: boolean
  owner: RestrictionsOwner | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'changed'): void
}>()

const auth = useAuthStore()
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

const catalogItems = RESTRICTION_CATALOG.map(r => ({
  label: r.label,
  value: r.value,
  category: r.category,
}))

const activeSpec = computed(() => (form.value.ruleType ? specFor(form.value.ruleType) : null))

const weekdayOptions = WEEKDAYS.map(w => ({ title: (w[0] ?? '').toUpperCase() + w.slice(1), value: w }))

const phaseOptions = DAY_PHASES.map(p => ({ title: PHASE_BOUNDARIES[p].label, value: p }))

const canSubmit = computed(() => {
  if (!form.value.ruleType) return false
  return validateRestrictionParams(form.value.ruleType, form.value.params) === null
})

function emptyForm() {
  return { ruleType: '', params: {} as Record<string, unknown>, enabled: true, weight: DEFAULT_SOFT_WEIGHT }
}

function paramsSummary(r: EntityRestriction): string {
  const spec = specFor(r.ruleType)
  if (!spec) return Object.entries(r.params ?? {}).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')
  return spec.params
    .map(p => {
      const value = (r.params ?? {})[p.key]
      if (value === undefined) return ''
      if (Array.isArray(value)) {
        const pretty = value.map(v => (p.type === 'phaseArray' ? PHASE_BOUNDARIES[v as DayPhase]?.label ?? v : v))
        return `${p.label}: ${pretty.join(', ')}`
      }
      return `${p.label}: ${String(value)}`
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
    weight: r.weight || (specFor(r.ruleType)?.category === 'soft' ? DEFAULT_SOFT_WEIGHT : 0),
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
  }
})
</script>