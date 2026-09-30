<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="640">
    <v-card>
      <v-card-title class="d-flex align-center">
        <span>Access — {{ entityName }}</span>
        <v-spacer />
        <v-btn icon variant="text" size="small" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-card-text>
        <div v-if="loading" class="text-caption text-medium-emphasis">Loading…</div>
        <template v-else>
          <div v-if="error" class="text-error text-caption mb-2">{{ error }}</div>

          <v-list density="compact" class="py-0">
            <v-list-item v-for="entry in entries" :key="entry.user_id" class="px-0">
              <template #prepend>
                <v-icon size="small" class="mr-2">
                  {{ roleIcon(entry.role) }}
                </v-icon>
              </template>
              <v-list-item-title class="text-body-2">
                {{ entry.name || entry.user_id }}
                <span v-if="entry.email" class="text-medium-emphasis">· {{ entry.email }}</span>
              </v-list-item-title>
              <template #append>
                <template v-if="canManage">
                  <v-select
                    :model-value="entry.role"
                    :items="roleItems"
                    density="compact"
                    hide-details
                    style="max-width: 130px"
                    @update:model-value="(role: AccessRole) => handleChange(entry, role)"
                  />
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    color="error"
                    class="ml-2"
                    @click="handleRemove(entry)"
                  >
                    <v-icon>mdi-close</v-icon>
                    <v-tooltip activator="parent">Revoke access</v-tooltip>
                  </v-btn>
                </template>
                <v-chip v-else size="small" variant="tonal" class="ml-2">{{ entry.role }}</v-chip>
              </template>
            </v-list-item>
            <div v-if="entries.length === 0" class="text-caption text-medium-emphasis">
              No access entries found.
            </div>
          </v-list>

          <template v-if="canManage">
            <v-divider class="my-4" />
            <div class="d-flex align-center ga-2">
              <v-autocomplete
                v-model="selectedUser"
                v-model:search="userSearchQuery"
                :items="userSearchResults"
                item-title="displayLabel"
                item-value="id"
                label="Add user"
                placeholder="Search by name or email..."
                density="compact"
                hide-details
                clearable
                :no-filter="true"
                style="max-width: 340px"
                @update:model-value="handleUserSelected"
              />
              <v-select
                v-model="selectedRole"
                :items="roleItems"
                density="compact"
                hide-details
                style="max-width: 130px"
              />
            </div>
          </template>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAcl } from '@/composables/useAcl'
import type { AccessRole, EntityAccessEntry } from '@/composables/useAcl'

const props = defineProps<{
  modelValue: boolean
  entity: string
  entityId?: string
  entityName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'changed': []
}>()

const { entries, loading, error, fetchAccess, addUser, changeRole, removeUser, searchUsers } = useAcl()

const canManage = computed(() => entries.value.some(e => e._canManage))
const selectedUser = ref<string | null>(null)
const selectedRole = ref<AccessRole>('read')
const userSearchQuery = ref('')
const userSearchResults = ref<Array<{ id: string; name: string; email: string; displayLabel: string }>>([])
let searchDebounce: ReturnType<typeof setTimeout> | null = null

const entityName = computed(() => props.entityName || props.entity)

const roleItems: { title: string; value: AccessRole }[] = [
  { title: 'Admin', value: 'admin' },
  { title: 'Write', value: 'write' },
  { title: 'Read', value: 'read' },
]

function roleIcon(role: AccessRole): string {
  if (role === 'admin') return 'mdi-shield-crown-outline'
  if (role === 'write') return 'mdi-pencil-outline'
  return 'mdi-eye-outline'
}

watch(() => props.modelValue, (open) => {
  if (open && props.entityId) {
    selectedUser.value = null
    userSearchQuery.value = ''
    userSearchResults.value = []
    selectedRole.value = 'read'
    fetchAccess(props.entity, props.entityId)
  }
})

watch(userSearchQuery, (q) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (!q || q.length < 2) {
    userSearchResults.value = []
    return
  }
  searchDebounce = setTimeout(async () => {
    const results = await searchUsers(q)
    const existingIds = new Set(entries.value.map(e => e.user_id))
    userSearchResults.value = results
      .filter(u => !existingIds.has(u.id))
      .map(u => ({ ...u, displayLabel: u.email ? `${u.name || u.id} (${u.email})` : (u.name || u.id) }))
  }, 300)
})

async function handleUserSelected(userId: string | null) {
  if (!userId || !props.entityId) return
  const ok = await addUser(props.entity, props.entityId, userId, selectedRole.value)
  if (ok) emit('changed')
  selectedUser.value = null
  userSearchQuery.value = ''
  userSearchResults.value = []
}

async function handleChange(entry: EntityAccessEntry, role: AccessRole) {
  if (!props.entityId || role === entry.role) return
  const ok = await changeRole(props.entity, props.entityId, entry.user_id, role)
  if (ok) emit('changed')
}

async function handleRemove(entry: EntityAccessEntry) {
  if (!props.entityId) return
  const ok = await removeUser(props.entity, props.entityId, entry.user_id)
  if (ok) emit('changed')
}
</script>