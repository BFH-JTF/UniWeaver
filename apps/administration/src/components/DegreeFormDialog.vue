<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit Degree' : 'Add Degree' }}</v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="degree.name"
            label="Name *"
            :rules="[v => !!v || 'Name is required']"
          />
          <v-textarea
            v-model="degree.description"
            label="Description"
            rows="3"
            auto-grow
          />
          <v-select
            v-model="selectedProgramIds"
            :items="programItems"
            item-title="title"
            item-value="value"
            label="Programs of the displayed curriculum"
            multiple
            chips
            clearable
          />
          <v-text-field
            v-model="degree.contact"
            label="Contact"
          />
          <v-text-field
            v-model="degree.url"
            label="URL"
          />

          <template v-if="isEdit && degree.id">
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
import type { Degree, Program } from '@/types/curriculum'

const ENTITY_TABLE = 'degrees'

const props = defineProps<{
  modelValue: boolean
  degreeData?: Degree
  programs: Program[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [degree: Degree]
}>()

const { admins: aclAdmins, loading: aclLoading, fetchAdmins, addAdmin, removeAdmin, searchUsers } = useAcl()
const selectedUser = ref<string | null>(null)
const userSearchQuery = ref('')
const userSearchResults = ref<Array<{ id: string; name: string; email: string; displayLabel: string }>>([])
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const isEdit = computed(() => !!props.degreeData?.id)

const formRef = ref()
const degree = ref<Degree>(emptyDegree())

const selectedProgramIds = computed({
  get: () => degree.value.ProgramIDs ?? degree.value.programIDs ?? degree.value.programIds ?? [],
  set: (val: string[]) => {
    degree.value.ProgramIDs = val
    degree.value.programIDs = val
    degree.value.programIds = val
  },
})

const programItems = computed(() =>
  props.programs.map(p => ({
    title: p.name || p.id || 'Unnamed',
    value: p.id,
  })).filter(p => p.value)
)

function emptyDegree(): Degree {
  return { name: '', ProgramIDs: [], programIDs: [], programIds: [] }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    degree.value = props.degreeData
      ? JSON.parse(JSON.stringify(props.degreeData))
      : emptyDegree()
    if (props.degreeData?.id) {
      fetchAdmins(ENTITY_TABLE, props.degreeData.id)
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
  if (!userId || !degree.value.id) return
  await addAdmin(ENTITY_TABLE, degree.value.id, userId)
  selectedUser.value = null
  userSearchQuery.value = ''
  userSearchResults.value = []
}

async function handleRemoveAdmin(userId: string) {
  if (!degree.value.id) return
  await removeAdmin(ENTITY_TABLE, degree.value.id, userId)
}

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const result = JSON.parse(JSON.stringify(degree.value))
  const ids = result.ProgramIDs ?? result.programIDs ?? result.programIds ?? []
  result.ProgramIDs = ids
  result.programIDs = ids
  result.programIds = ids
  emit('save', result)
  emit('update:modelValue', false)
}
</script>