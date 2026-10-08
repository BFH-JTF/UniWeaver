<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon color="primary" size="36" class="mr-3">mdi-calendar-clock-outline</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Lecturer Availability</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Mark when lecturers are NOT available</p>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>

    <v-alert
      v-if="ownLecturerMissing"
      type="info"
      variant="tonal"
      icon="mdi-account-off-outline"
    >
      You are marked as "not a lecturer" in your account, so you have no availability to manage.
      You can change this in the user portal.
    </v-alert>

    <!-- Self-service: no scheduler rights → own availability only -->
    <template v-else-if="!canEditAll">
      <UnavailabilityEditor
        v-if="selfLecturer"
        :lecturer="selfLecturer"
        :lecturers="[selfLecturer]"
        :can-edit="true"
        @changed="onSelfSaved"
      />
      <div v-else-if="!loading" class="text-medium-emphasis">
        Loading your availability...
      </div>
    </template>

    <!-- Scheduler / global admin: master-detail over all lecturers -->
    <v-card v-else class="rounded-lg elevation-1">
      <v-toolbar density="comfortable" color="surface" class="border-b">
        <v-icon color="primary" class="mr-2">mdi-account-group</v-icon>
        <span class="text-subtitle-1 font-weight-bold">Lecturers</span>
        <v-chip color="primary" variant="tonal" size="small" class="ml-3 font-weight-bold">
          {{ filteredLecturers.length }} of {{ lecturers.length }}
        </v-chip>
        <v-spacer />
        <v-text-field
          v-model="search"
          label="Search lecturers"
          prepend-inner-icon="mdi-magnify"
          clearable
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 280px"
          class="mr-3"
        />
        <v-checkbox
          v-model="todoFilter"
          label="Only lecturers without blocks"
          color="primary"
          density="compact"
          hide-details
          class="mr-2"
        />
      </v-toolbar>

      <div class="d-flex" style="height: calc(100vh - 330px); min-height: 420px">
        <div class="master-pane border-e d-flex flex-column">
          <div class="flex-1-1 overflow-y-auto pa-2">
            <v-list density="compact" nav>
              <v-list-item
                v-for="item in filteredLecturers"
                :key="item.id"
                :active="item.id === selectedId"
                :title="item.name"
                :subtitle="item.departmentName || item.displayLabel"
                class="rounded-lg ma-1"
                @click="selectLecturer(item.id)"
              >
                <template #append>
                  <v-chip
                    v-if="item.unavailabilityCount > 0"
                    size="x-small"
                    variant="tonal"
                    color="warning"
                    class="font-weight-bold"
                  >
                    {{ item.unavailabilityCount }}
                  </v-chip>
                  <v-chip v-else size="x-small" variant="tonal" color="success">
                    free
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </div>

        <div class="flex-1-1 pa-4 overflow-y-auto">
          <UnavailabilityEditor
            v-if="selectedLecturer"
            :key="selectedLecturer.id"
            :lecturer="selectedLecturer"
            :lecturers="lecturers"
            :can-edit="true"
            @changed="reloadLecturers"
          />
          <div v-else class="text-center pa-10 text-medium-emphasis">
            <v-icon size="48" class="mb-3">mdi-arrow-left-circle-outline</v-icon>
            <div class="text-h6 mb-1">Select a lecturer</div>
            <div>Their unavailability will appear here.</div>
          </div>
        </div>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { SchedulingLecturer } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'
import { useAuthStore } from '@/stores/auth'
import UnavailabilityEditor from '@/components/UnavailabilityEditor.vue'

const auth = useAuthStore()
const canEditAll = computed(() => auth.canSchedule)

const lecturers = ref<SchedulingLecturer[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const todoFilter = ref(false)
const selectedId = ref('')
const selfLecturer = ref<SchedulingLecturer | null>(null)
const ownLecturerMissing = ref(false)

const filteredLecturers = computed(() => {
  const q = (search.value || '').trim().toLowerCase()
  return lecturers.value.filter(l => {
    if (todoFilter.value && l.unavailabilityCount > 0) return false
    if (!q) return true
    return `${l.name} ${l.departmentName} ${l.displayLabel}`.toLowerCase().includes(q)
  })
})

const selectedLecturer = computed(() =>
  lecturers.value.find(l => l.id === selectedId.value) ?? null,
)

function selectLecturer(id: string): void {
  selectedId.value = id
}

async function loadSelf(): Promise<SchedulingLecturer | null> {
  try {
    // Validates session; the lecturer row itself comes from the list endpoint.
    const all = await api.listLecturers()
    const self = all.find(l => l.accountId === auth.localUser?.id) ?? null
    selfLecturer.value = self
    return self
  } catch {
    return null
  }
}

async function reloadLecturers(): Promise<void> {
  error.value = ''
  try {
    lecturers.value = await api.listLecturers()
    if (selectedId.value && !lecturers.value.some(l => l.id === selectedId.value)) {
      selectedId.value = lecturers.value[0]?.id ?? ''
    } else if (!selectedId.value) {
      selectedId.value = lecturers.value[0]?.id ?? ''
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load lecturers'
  }
}

function onSelfSaved(): void {
  error.value = ''
}

onMounted(async () => {
  loading.value = true
  try {
    if (canEditAll.value) {
      await reloadLecturers()
    } else {
      const self = await loadSelf()
      if (!self) ownLecturerMissing.value = true
    }
  } finally {
    loading.value = false
  }
})
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