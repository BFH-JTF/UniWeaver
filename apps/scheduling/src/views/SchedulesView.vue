<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon color="primary" size="36" class="mr-3">mdi-calendar-multiple-check</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Schedules</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Generate and review the semester schedule</p>
      </div>
      <v-spacer />
      <v-btn
        v-if="auth.canSchedule"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openWizard"
      >
        New Schedule…
      </v-btn>
    </div>

    <v-alert
      v-if="!auth.canSchedule"
      type="warning"
      variant="tonal"
      icon="mdi-lock-outline"
    >
      Scheduler permission required. Ask an administrator to grant you the Scheduler role
      to generate schedules.
    </v-alert>

    <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4" closable @click:close="loadError = ''">
      {{ loadError }}
    </v-alert>

    <template v-if="auth.canSchedule">
      <div v-if="loading && !runs.length" class="d-flex align-center py-8">
        <v-progress-circular indeterminate color="primary" size="32" class="mr-3" />
        <span class="text-medium-emphasis">Loading schedules...</span>
      </div>

      <v-card v-else-if="runs.length" class="rounded-lg elevation-1">
        <v-data-table
          :headers="headers"
          :items="runs"
          items-per-page="15"
          density="compact"
          @click:row="(_e: unknown, row: { item: ScheduleRun }) => openRun(row.item)"
        >
          <template #item.name="{ item }">
            <span class="font-weight-medium">{{ item.name }}</span>
          </template>
          <template #item.semester="{ item }">
            {{ item.semesterName || item.semesterId }}
          </template>
          <template #item.status="{ item }">
            <v-chip size="small" variant="tonal" :color="statusColor(item.status)">
              {{ statusLabel(item.status) }}
              <v-progress-circular v-if="item.status === 'generating'" indeterminate size="10" width="2" class="ml-1" />
            </v-chip>
          </template>
          <template #item.feasible="{ item }">
            <template v-if="item.status === 'draft'">
              <v-icon v-if="item.score.feasible" color="success" size="18">mdi-check-circle</v-icon>
              <v-tooltip v-if="!item.score.feasible" activator="parent">
                <template #activator="{ props }">
                  <v-icon v-bind="props" color="warning" size="18">mdi-alert-circle</v-icon>
                </template>
                Not all sessions could be placed
              </v-tooltip>
              <span v-if="!item.score.feasible" class="ml-1 text-warning">Unplaced: {{ item.stats.sessionsUnplaced ?? '?' }}</span>
            </template>
            <span v-else class="text-medium-emphasis">–</span>
          </template>
          <template #item.entries="{ item }">
            {{ item.entryCount }}
          </template>
          <template #item.created="{ item }">
            {{ formatDateTime(item.createdAt) }}
          </template>
          <template #item.actions="{ item }">
            <v-btn
              icon="mdi-eye-outline"
              size="x-small"
              variant="text"
              color="primary"
              :disabled="!(['draft', 'published'].includes(item.status))"
              @click.stop="openRun(item)"
            >
              <v-tooltip activator="parent">View schedule</v-tooltip>
            </v-btn>
            <v-btn
              v-if="['draft', 'failed'].includes(item.status)"
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="error"
              @click.stop="askDelete(item)"
            >
              <v-tooltip activator="parent">Delete schedule</v-tooltip>
            </v-btn>
          </template>
        </v-data-table>
      </v-card>

      <v-empty-state
        v-else-if="!loading"
        icon="mdi-calendar-multiple-check"
        headline="No schedules yet"
        text="Generate the first schedule with the bundled scheduler."
        color="primary"
      />
    </template>

    <!-- Generation wizard -->
    <v-dialog v-model="wizardOpen" persistent max-width="640">
      <v-card class="rounded-lg">
        <v-toolbar density="comfortable" color="surface" class="border-b">
          <v-icon color="primary" class="mr-2">mdi-wizard-hat</v-icon>
          <span class="text-subtitle-1 font-weight-bold">Generate a schedule</span>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="closeWizard" />
        </v-toolbar>
        <v-card-text class="pa-6">
          <v-stepper v-model="step" :items="wizardSteps" flat>
            <template #item.1>
              <v-alert
                v-if="stepError"
                type="error"
                variant="tonal"
                density="compact"
                class="mb-4"
              >
                {{ stepError }}
              </v-alert>
              <p class="text-body-2 text-medium-emphasis mb-2">For which semester should the schedule be generated?</p>
              <v-select
                v-model="selectedSemesterId"
                :items="semesterItems"
                item-title="label"
                item-value="id"
                label="Semester"
                variant="outlined"
                density="compact"
                :disabled="!semesters.length"
                @update:model-value="onSemesterChosen"
              />
              <div v-if="selectedSemester" class="text-body-2 text-medium-emphasis mt-2">
                <template v-if="selectedSemester.slotStartTimes.length">
                  <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
                  Timeslot grid: {{ selectedSemester.slotDurationMinutes }} min slots at
                  {{ selectedSemester.slotStartTimes.join(', ') }} ·
                  {{ selectedSemester.weekCount }} weeks ·
                  {{ selectedSemester.classCount }} classes
                </template>
                <v-chip v-else color="warning" variant="tonal" size="small">
                  No timeslot grid configured for this semester yet
                </v-chip>
              </div>
            </template>

            <template #item.2>
              <div v-if="scopeLoading" class="d-flex align-center py-4">
                <v-progress-circular indeterminate color="primary" size="24" class="mr-3" />
                <span class="text-medium-emphasis">Analyzing data...</span>
              </div>
              <template v-else-if="scope">
                <p class="text-body-2 text-medium-emphasis mb-3">Schedule scope:</p>
                <div class="d-flex flex-wrap ga-2 mb-3">
                  <v-chip variant="tonal" prepend-icon="mdi-calendar-check">Schedule sessions: {{ scope.sessions }}</v-chip>
                  <v-chip variant="tonal" prepend-icon="mdi-account-group">Classes: {{ scope.classes }}</v-chip>
                  <v-chip variant="tonal" prepend-icon="mdi-book-open-variant">Modules: {{ scope.modules }}</v-chip>
                  <v-chip variant="tonal" prepend-icon="mdi-door-open">Rooms: {{ scope.rooms }}</v-chip>
                  <v-chip variant="tonal" prepend-icon="mdi-account-tie">Lecturers: {{ scope.lecturers }}</v-chip>
                </div>
                <v-alert
                  v-for="(warning, i) in scope.warnings"
                  :key="i"
                  type="info"
                  variant="tonal"
                  density="compact"
                  class="mb-2"
                >
                  {{ warning }}
                </v-alert>
                <v-text-field
                  v-model="runName"
                  label="Name (optional)"
                  variant="outlined"
                  density="compact"
                  placeholder="e.g. FS2026 draft 1"
                  class="mt-3"
                />
                <div class="mt-2">
                  <p class="text-body-2 text-medium-emphasis mb-1">
                    <v-icon size="14" class="mr-1">mdi-timer-outline</v-icon>
                    Computing time: the longer the solver works, the better the possible schedule.
                  </p>
                  <div class="d-flex align-center ga-3">
                    <v-slider
                      v-model="spentLimitSeconds"
                      :min="10"
                      :max="300"
                      :step="5"
                      color="primary"
                      thumb-label
                      hide-details
                      class="flex-fill"
                    />
                    <span class="text-body-2 text-medium-emphasis" style="min-width: 90px">
                      {{ spentLimitSeconds }} seconds
                    </span>
                  </div>
                </div>
              </template>
            </template>

            <template #item.3>
              <template v-if="starting">
                <div class="d-flex align-center py-4">
                  <v-progress-circular indeterminate color="primary" size="28" class="mr-3" />
                  <span>
                    <span class="font-weight-medium">Solving is running…</span>
                    <span class="text-medium-emphasis ml-2">You can close this dialog; the schedule appears in the list.</span>
                  </span>
                </div>
              </template>
              <template v-else-if="startError">
                <v-alert type="error" variant="tonal" density="compact">
                  {{ startError }}
                </v-alert>
              </template>
            </template>
          </v-stepper>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="text" @click="closeWizard">
            {{ step < 3 ? 'Cancel' : 'Close' }}
          </v-btn>
          <v-btn
            v-if="step < 3"
            color="primary"
            :disabled="!canAdvance"
            @click="step += 1"
          >
            {{ step === 2 ? 'Continue' : 'Next' }}
          </v-btn>
          <v-btn
            v-else
            color="primary"
            prepend-icon="mdi-cog"
            :loading="starting"
            :disabled="!schedulerOnline || scopeLoading || !scope || scope.gridMissing"
            @click="startGeneration"
          >
            Generate schedule
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="deleteTarget !== null" max-width="420" @update:model-value="(open: boolean) => { if (!open) deleteTarget = null }">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6">Delete schedule?</v-card-title>
        <v-card-text>
          {{ deleteTarget?.name }} will be deleted along with all of its schedule entries.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteTarget = null">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Run detail (read-only timetable) -->
    <v-dialog v-model="detailOpen" max-width="1100" scrollable>
      <v-card v-if="detailRun" class="rounded-lg">
        <v-toolbar density="comfortable" color="surface" class="border-b">
          <v-icon color="primary" class="mr-2">mdi-calendar-multiple-check</v-icon>
          <span class="text-subtitle-1 font-weight-bold">{{ detailRun.name }}</span>
          <v-chip size="small" variant="tonal" :color="statusColor(detailRun.status)" class="ml-3">
            {{ statusLabel(detailRun.status) }}
          </v-chip>
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="detailOpen = false" />
        </v-toolbar>
        <v-card-text class="pa-5">
          <ScheduleTimetable :run-id="detailRun.id" :semester-id="detailRun.semesterId" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SchedulingSemester, ScheduleRun, ScheduleScopeSummary } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'
import { useAuthStore } from '@/stores/auth'
import ScheduleTimetable from '@/components/ScheduleTimetable.vue'

type ScopeSummary = ScheduleScopeSummary

const auth = useAuthStore()
const runs = ref<ScheduleRun[]>([])
const loading = ref(false)
const loadError = ref('')

// Wizard state
const wizardOpen = ref(false)
const step = ref(1)
const wizardSteps = ['Semester', 'Scope', 'Generate']
const semesters = ref<SchedulingSemester[]>([])
const selectedSemesterId = ref<string | null>(null)
const runName = ref('')
const spentLimitSeconds = ref(60)
const scope = ref<ScopeSummary | null>(null)
const scopeLoading = ref(false)
const stepError = ref('')
const starting = ref(false)
const startError = ref('')
const schedulerOnline = ref(true)
const generatorTimer = ref<ReturnType<typeof setInterval> | null>(null)

const deleteTarget = ref<ScheduleRun | null>(null)
const deleting = ref(false)

const detailOpen = ref(false)
const detailRun = ref<ScheduleRun | null>(null)

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Semester', key: 'semester' },
  { title: 'Status', key: 'status' },
  { title: 'Placed', key: 'feasible' },
  { title: 'Entries', key: 'entries' },
  { title: 'Created', key: 'created' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const semesterItems = computed(() =>
  semesters.value.map((s) => ({
    id: s.id,
    label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
  })),
)

const selectedSemester = computed(() =>
  semesters.value.find((s) => s.id === selectedSemesterId.value) ?? null,
)

watch(step, async (newStep) => {
  if (newStep === 2) {
    await loadScopeForStep()
  }
})

const canAdvance = computed(() => {
  if (step.value === 1) {
    return !!selectedSemesterId.value && !!selectedSemester.value?.slotStartTimes.length
  }
  if (step.value === 2) return !!scope.value && !scope.value.gridMissing
  return true
})

function statusColor(status: ScheduleRun['status']): string {
  switch (status) {
    case 'draft': return 'info'
    case 'published': return 'success'
    case 'failed': return 'error'
    case 'generating': return 'secondary'
    default: return 'default'
  }
}

function statusLabel(status: ScheduleRun['status']): string {
  const labels: Record<ScheduleRun['status'], string> = {
    pending: 'Queued',
    generating: 'Generating',
    draft: 'Draft',
    published: 'Published',
    failed: 'Failed',
  }
  return labels[status]
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

async function reload(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    runs.value = await api.listSchedules()
    if (runs.value.some((r) => r.status === 'generating' || r.status === 'pending')) {
      schedulePoll()
    } else {
      stopPoll()
    }
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load schedules'
  } finally {
    loading.value = false
  }
}

function schedulePoll(): void {
  if (generatorTimer.value) return
  generatorTimer.value = setInterval(async () => {
    const stillRunning = runs.value.some((r) => r.status === 'generating' || r.status === 'pending')
    if (!stillRunning) {
      stopPoll()
      return
    }
    try {
      runs.value = await api.listSchedules()
      const updated = runs.value.some((r) => r.status === 'generating' || r.status === 'pending')
      if (!updated) {
        stopPoll()
        // Refresh detail view if the finished run is open.
        if (detailOpen.value && detailRun.value) {
          detailRun.value = runs.value.find((r) => r.id === detailRun.value!.id) ?? detailRun.value
        }
      }
    } catch {
      // transient polling errors are ignored
    }
  }, 2500)
}

function stopPoll(): void {
  if (generatorTimer.value) {
    clearInterval(generatorTimer.value)
    generatorTimer.value = null
  }
}

async function openWizard(): Promise<void> {
  wizardOpen.value = true
  step.value = 1
  selectedSemesterId.value = null
  scope.value = null
  stepError.value = ''
  startError.value = ''
  runName.value = ''
  spentLimitSeconds.value = 60
  try {
    semesters.value = await api.listSchedulingSemesters()
    if (!semesters.value.length) {
      stepError.value = 'No semesters defined. Create a semester in the administration app first.'
    }
  } catch (err: unknown) {
    stepError.value = err instanceof Error ? err.message : 'Failed to load semesters'
  }
}

function closeWizard(): void {
  wizardOpen.value = false
  stopPoll()
  void reload()
}

async function onSemesterChosen(): Promise<void> {
  scope.value = null
}

async function loadScopeForStep(): Promise<void> {
  if (step.value === 2 && selectedSemesterId.value) {
    scopeLoading.value = true
    stepError.value = ''
    try {
      schedulerOnline.value = (await api.getSchedulerHealth()).online
      scope.value = await api.getScheduleScope(selectedSemesterId.value)
    } catch (err: unknown) {
      stepError.value = err instanceof Error ? err.message : 'Failed to analyze schedule scope'
    } finally {
      scopeLoading.value = false
    }
  }
}

async function startGeneration(): Promise<void> {
  if (!selectedSemesterId.value || !scope.value) return
  starting.value = true
  startError.value = ''
  try {
    const { runId } = await api.generateSchedule(selectedSemesterId.value, {
      name: runName.value || undefined,
      spentLimitSeconds: spentLimitSeconds.value,
    })
    starting.value = false
    closeWizard()
    const created = await api.getScheduleRun(runId)
    detailRun.value = created
    detailOpen.value = true
    await reload()
  } catch (err: unknown) {
    starting.value = false
    startError.value = err instanceof Error ? err.message : 'Failed to start schedule generation'
  }
}

async function openRun(run: ScheduleRun): Promise<void> {
  detailRun.value = run
  detailOpen.value = true
}

async function askDelete(run: ScheduleRun): Promise<void> {
  deleteTarget.value = run
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteScheduleRun(deleteTarget.value.id)
    deleteTarget.value = null
    await reload()
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : 'Failed to delete schedule'
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  if (auth.canSchedule) {
    await reload()
  }
})

onBeforeUnmount(stopPoll)
</script>