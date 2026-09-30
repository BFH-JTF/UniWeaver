<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="700" persistent>
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit Module' : 'Add Module' }}</v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="mod.name"
            label="Name *"
            :rules="[v => !!v || 'Name is required']"
          />
          <v-text-field
            v-model="mod.code"
            label="Code"
          />
          <v-textarea
            v-model="mod.description"
            label="Description"
            rows="2"
            auto-grow
          />
          <v-select
            v-model="selectedDegreeIds"
            :items="degreeItems"
            item-title="title"
            item-value="value"
            label="Degrees of the displayed curriculum"
            multiple
            chips
            clearable
          />
          <v-select
            v-model="selectedClassIds"
            :items="classItems"
            item-title="title"
            item-value="value"
            label="Classes"
            hint="Assign this module to one or more classes"
            persistent-hint
            multiple
            chips
            clearable
          />
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="mod.creditPoints"
                label="Credit Points (ECTS)"
                type="number"
                min="0"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="mod.contactHours"
                label="Contact Hours"
                type="number"
                min="0"
              />
            </v-col>
          </v-row>
          <v-text-field
            v-model="mod.contact"
            label="Contact"
          />
          <v-text-field
            v-model="mod.url"
            label="URL"
          />

          <v-divider class="my-4" />
          <h3 class="text-subtitle-1 mb-2">Constraints</h3>
          <div v-for="(c, idx) in mod.constraints" :key="idx" class="d-flex align-center ga-2 mb-2">
            <v-select
              v-model="c.type"
              :items="constraintTypeOptions"
              label="Type"
              density="compact"
              style="max-width: 180px"
            />
            <v-text-field
              v-model="c.targetModuleId"
              label="Target Module ID"
              density="compact"
            />
            <v-btn icon variant="text" size="small" color="error" @click="removeConstraint(idx)">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </div>
          <v-btn variant="outlined" size="small" prepend-icon="mdi-plus" @click="addConstraint">
            Add Constraint
          </v-btn>

          <template v-if="isEdit && mod.id">
            <v-divider class="my-4" />
            <div class="text-subtitle-2 mb-2">Administrators</div>
            <div v-if="aclLoading" class="text-caption text-medium-emphasis">Loading...</div>
            <div v-else-if="aclAdmins.length === 0" class="text-caption text-medium-emphasis">No administrators found</div>
            <div v-else>
              <v-chip
                v-for="admin in aclAdmins"
                :key="admin.user_id"
                variant="tonal"
                closable
                class="mr-1 mb-1"
                @click:close="handleRemoveAdmin(admin.user_id)"
              >
                {{ admin.name || admin.user_id }}
              </v-chip>
            </div>
            <v-autocomplete
              v-model="selectedUser"
              v-model:search="userSearchQuery"
              :items="userSearchResults"
              item-title="displayLabel"
              item-value="id"
              label="Add administrator"
              placeholder="Search by name or email..."
              density="compact"
              hide-details
              clearable
              :no-filter="true"
              class="mt-2"
              style="max-width: 400px"
              @update:model-value="handleUserSelected"
            />
          </template>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAcl } from '@/composables/useAcl'
import type { Module, ModuleConstraint, Degree } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'

const ENTITY_TABLE = 'modules'

const props = defineProps<{
  modelValue: boolean
  moduleData?: Module
  degrees: Degree[]
  classes: ClassEntity[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [mod: Module]
}>()

const { admins: aclAdmins, loading: aclLoading, fetchAdmins, addAdmin, removeAdmin, searchUsers } = useAcl()
const selectedUser = ref<string | null>(null)
const userSearchQuery = ref('')
const userSearchResults = ref<Array<{ id: string; name: string; email: string; displayLabel: string }>>([])
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const isEdit = computed(() => !!props.moduleData?.id)

const formRef = ref()
const mod = ref<Module>(emptyModule())

const constraintTypeOptions: { title: string; value: ModuleConstraint['type'] }[] = [
  { title: 'Requires', value: 'requires' },
  { title: 'Corequisite', value: 'corequisite' },
  { title: 'Forbids', value: 'forbids' },
]

const selectedDegreeIds = computed({
  get: () => mod.value.DegreeIDs ?? mod.value.degreeIDs ?? mod.value.degreeIds ?? [],
  set: (val: string[]) => {
    mod.value.DegreeIDs = val
    mod.value.degreeIDs = val
    mod.value.degreeIds = val
  },
})

// ClassEntity owns the ERD relationship (CLASS_ENTITY.moduleIds).  Keep the
// selection on the module dialog as a convenient editing field and pass it to
// the parent for persistence on the class records.
const selectedClassIds = ref<string[]>([])

const degreeItems = computed(() =>
  props.degrees.map(d => ({
    title: d.name || d.id || 'Unnamed',
    value: d.id,
  })).filter(d => d.value)
)

const classItems = computed(() => props.classes.map(c => ({
  title: c.name || c.code || c.id || 'Unnamed',
  value: c.id || c._id,
})).filter(c => c.value))

function emptyModule(): Module {
  return { name: '', DegreeIDs: [], degreeIDs: [], degreeIds: [], constraints: [] }
}

function addConstraint() {
  if (!mod.value.constraints) mod.value.constraints = []
  mod.value.constraints.push({ type: 'requires', targetModuleId: '' })
}

function removeConstraint(idx: number) {
  mod.value.constraints?.splice(idx, 1)
  if (mod.value.constraints && mod.value.constraints.length === 0) {
    mod.value.constraints = undefined
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    mod.value = props.moduleData
      ? JSON.parse(JSON.stringify(props.moduleData))
      : emptyModule()
    const moduleId = props.moduleData?.id || props.moduleData?._id
    selectedClassIds.value = moduleId
      ? props.classes.filter(c => (c.moduleIds || []).includes(moduleId)).map(c => c.id || c._id).filter(Boolean) as string[]
      : []
    if (!mod.value.constraints) mod.value.constraints = []
    if (props.moduleData?.id) {
      fetchAdmins(ENTITY_TABLE, props.moduleData.id)
    }
  }
  selectedUser.value = null
  userSearchQuery.value = ''
  userSearchResults.value = []
})

watch(userSearchQuery, (q) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (!q || q.length < 2) {
    userSearchResults.value = []
    return
  }
  searchDebounce = setTimeout(async () => {
    const results = await searchUsers(q)
    const existingIds = new Set(aclAdmins.value.map(a => a.user_id))
    userSearchResults.value = results
      .filter(u => !existingIds.has(u.id))
      .map(u => ({ ...u, displayLabel: u.email ? `${u.name || u.id} (${u.email})` : (u.name || u.id) }))
  }, 300)
})

async function handleUserSelected(userId: string | null) {
  if (!userId || !mod.value.id) return
  await addAdmin(ENTITY_TABLE, mod.value.id, userId)
  selectedUser.value = null
  userSearchQuery.value = ''
  userSearchResults.value = []
}

async function handleRemoveAdmin(userId: string) {
  if (!mod.value.id) return
  await removeAdmin(ENTITY_TABLE, mod.value.id, userId)
}

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const result = JSON.parse(JSON.stringify(mod.value))
  result.classIds = [...selectedClassIds.value]
  const ids = result.DegreeIDs ?? result.degreeIDs ?? result.degreeIds ?? []
  result.DegreeIDs = ids
  result.degreeIDs = ids
  result.degreeIds = ids
  if (result.constraints && result.constraints.length === 0) {
    delete result.constraints
  }
  if (result.constraints) {
    result.constraints = result.constraints.filter((c: ModuleConstraint) => c.targetModuleId)
  }
  emit('save', result)
  emit('update:modelValue', false)
}
</script>
