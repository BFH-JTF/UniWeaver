<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit Program' : 'Add Program' }}</v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="program.name"
            label="Name *"
            :rules="[v => !!v || 'Name is required']"
          />
          <v-textarea
            v-model="program.description"
            label="Description"
            rows="3"
            auto-grow
          />
          <v-select
            v-model="selectedDepartmentIds"
            :items="departmentItems"
            item-title="title"
            item-value="value"
            label="Departments"
            multiple
            chips
            clearable
          />
          <v-text-field
            v-model="program.contact"
            label="Contact"
          />
          <v-text-field
            v-model="program.url"
            label="URL"
          />

          <template v-if="isEdit && program.id">
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
import type { Program, Department } from '@/types/curriculum'

const ENTITY_TABLE = 'programs'

const props = defineProps<{
  modelValue: boolean
  programData?: Program
  departments: Department[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [program: Program]
}>()

const { admins: aclAdmins, loading: aclLoading, fetchAdmins, addAdmin, removeAdmin, searchUsers } = useAcl()
const selectedUser = ref<string | null>(null)
const userSearchQuery = ref('')
const userSearchResults = ref<Array<{ id: string; name: string; email: string; displayLabel: string }>>([])
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const isEdit = computed(() => !!props.programData?.id)

const formRef = ref()
const program = ref<Program>(emptyProgram())

const selectedDepartmentIds = computed({
  get: () => program.value.departmentIDs ?? program.value.departmentIds ?? [],
  set: (val: string[]) => {
    program.value.departmentIDs = val
    program.value.departmentIds = val
  },
})

const departmentItems = computed(() =>
  props.departments.map(d => ({
    title: d.name || d.id || 'Unnamed',
    value: d.id,
  })).filter(d => d.value)
)

function emptyProgram(): Program {
  return { name: '', departmentIDs: [], departmentIds: [] }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    program.value = props.programData
      ? JSON.parse(JSON.stringify(props.programData))
      : emptyProgram()
    if (props.programData?.id) {
      fetchAdmins(ENTITY_TABLE, props.programData.id)
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
  if (!userId || !program.value.id) return
  await addAdmin(ENTITY_TABLE, program.value.id, userId)
  selectedUser.value = null
  userSearchQuery.value = ''
  userSearchResults.value = []
}

async function handleRemoveAdmin(userId: string) {
  if (!program.value.id) return
  await removeAdmin(ENTITY_TABLE, program.value.id, userId)
}

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const result = JSON.parse(JSON.stringify(program.value))
  const ids = result.departmentIDs ?? result.departmentIds ?? []
  result.departmentIDs = ids
  result.departmentIds = ids
  emit('save', result)
  emit('update:modelValue', false)
}
</script>