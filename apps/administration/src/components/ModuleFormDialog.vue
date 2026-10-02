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
                v-model.number="mod.timeslots"
                :label="timeslotInputInfo ? `# of Timeslots (${timeslotInputInfo.duration} minutes)` : '# of Timeslots'"
                :hint="timeslotInputInfo
                  ? `One module instance spans ${mod.timeslots ?? '?'} × ${timeslotInputInfo.duration} min`
                  : 'Semester without timeslot grid — define the grid in the semester settings'"
                persistent-hint
                type="number"
                min="0"
                step="1"
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
          <h3 class="text-subtitle-1 mb-2">Scheduling Restrictions</h3>
          <p class="text-caption text-medium-emphasis mb-2">
            Weekday/time/date restrictions for scheduling. Inherited restrictions from parent degrees,
            programs and departments apply automatically.
          </p>
          <v-btn
            v-if="mod.id || mod._id"
            variant="outlined"
            size="small"
            prepend-icon="mdi-shield-lock-outline"
            @click="restrictionsDialogOpen = true"
          >
            Manage Restrictions
          </v-btn>
          <v-alert
            v-else
            type="info"
            variant="tonal"
            density="compact"
            text="Save the module first to manage its scheduling restrictions."
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>

    <RestrictionsDialog
      v-model="restrictionsDialogOpen"
      :owner="restrictionsOwner"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Module, Degree } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'
import RestrictionsDialog from '@/components/RestrictionsDialog.vue'
import type { RestrictionsOwner } from '@/composables/useRestrictions'

const props = defineProps<{
  modelValue: boolean
  moduleData?: Module
  degrees: Degree[]
  classes: ClassEntity[]
  /** Timeslot grid of the semester the displayed curriculum version is for. */
  semesterTimeslots?: { duration?: number; startTimes?: string[] } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [mod: Module]
}>()

const isEdit = computed(() => !!props.moduleData?.id)

// Slot length of the semester the displayed curriculum version is for, used
// to contextualize the "# of Timeslots" input.
const timeslotInputInfo = computed(() => {
  const duration = props.semesterTimeslots?.duration
  return duration && duration > 0 ? { duration } : null
})

const formRef = ref()
const mod = ref<Module>(emptyModule())

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

const restrictionsDialogOpen = ref(false)
const restrictionsOwner = ref<RestrictionsOwner | null>(null)

watch(() => props.moduleData?.id || props.moduleData?._id, (moduleId) => {
  if (moduleId && props.moduleData) {
    restrictionsOwner.value = {
      table: 'modules',
      id: moduleId,
      name: props.moduleData.name || '',
      _canEdit: props.moduleData._canEdit,
    }
  } else {
    restrictionsOwner.value = null
  }
}, { immediate: true })

const degreeItems = computed(() => {
  const auth = useAuthStore()
  // Non-global admins may only tie modules to degrees they administer.
  const selectable = auth.isAdmin ? props.degrees : props.degrees.filter(d => d._isAdmin)
  return selectable
    .map(d => ({
      title: d.name || d.id || 'Unnamed',
      value: d.id,
    }))
    .filter(d => d.value)
})

const classItems = computed(() => props.classes.map(c => ({
  title: c.name || c.code || c.id || 'Unnamed',
  value: c.id || c._id,
})).filter(c => c.value))

function emptyModule(): Module {
  return { name: '', DegreeIDs: [], degreeIDs: [], degreeIds: [] }
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
  }
})

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const result = JSON.parse(JSON.stringify(mod.value))
  result.classIds = [...selectedClassIds.value]
  const ids = result.DegreeIDs ?? result.degreeIDs ?? result.degreeIds ?? []
  result.DegreeIDs = ids
  result.degreeIDs = ids
  result.degreeIds = ids
  emit('save', result)
  emit('update:modelValue', false)
}
</script>
