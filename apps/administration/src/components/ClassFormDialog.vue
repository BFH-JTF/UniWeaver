<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-account-group" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">{{ isEdit ? 'Edit Class' : 'Add Class' }}</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Define a student group or cohort
        </v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" @click="close" />
        </template>
      </v-card-item>

      <v-card-text class="pa-4 pa-sm-6">
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="form.name"
            label="Name *"
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'Name is required']"
            placeholder="e.g. 1BINF-2024, 3MECH-A"
            class="mb-3"
          />

          <v-text-field
            v-model="form.code"
            label="Code"
            variant="outlined"
            density="compact"
            placeholder="e.g. 1BINF24"
            class="mb-3"
          />

          <v-textarea
            v-model="form.description"
            label="Description"
            variant="outlined"
            density="compact"
            rows="2"
            auto-grow
            class="mb-3"
          />

          <v-autocomplete
            v-model="form.degreeId"
            :items="degreeItems"
            item-title="title"
            item-value="value"
            label="Degree of the displayed curriculum"
            variant="outlined"
            density="compact"
            clearable
            class="mb-3"
          />

          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-3"
            text="Classes are always part of the currently displayed curriculum version."
          />

          <template v-if="form.degreeId">
            <v-autocomplete
              v-model="form.moduleIds"
              :items="moduleItems"
              item-title="title"
              item-value="value"
              label="Modules of this degree"
              hint="Which modules of the selected degree this class attends"
              persistent-hint
              variant="outlined"
              density="compact"
              multiple
              chips
              closable-chips
              class="mb-3"
            />
          </template>
          <template v-else>
            <div class="text-caption text-medium-emphasis mb-3">
              Select a degree above to choose which modules this class attends.
            </div>
          </template>

          <v-autocomplete
            v-model="form.programIds"
            :items="programs"
            item-title="name"
            item-value="id"
            label="Programs of the displayed curriculum"
            variant="outlined"
            density="compact"
            multiple
            chips
            closable-chips
            class="mb-3"
          />

          <v-autocomplete
            v-model="form.semesterId"
            :items="semesterItems"
            item-title="title"
            item-value="id"
            label="Semester"
            variant="outlined"
            density="compact"
            clearable
            class="mb-3"
          />

          <v-text-field
            v-model.number="form.size"
            label="Class Size"
            variant="outlined"
            density="compact"
            type="number"
            placeholder="e.g. 30"
            class="mb-3"
          />

          <v-text-field
            v-model="form.contact"
            label="Contact"
            variant="outlined"
            density="compact"
            class="mb-3"
          />

          <v-text-field
            v-model="form.url"
            label="URL"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
        </v-form>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">
          {{ isEdit ? 'Save' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ClassEntity } from '@/types/curriculumClass'
import type { Degree, Module, Program } from '@/types/curriculum'
import type { Semester } from '@/stores/curriculum'
import { emptyClass } from '@/composables/useClasses'

const props = defineProps<{
  modelValue: boolean
  classData?: ClassEntity
  programs: Program[]
  degrees: Degree[]
  /** Modules of the displayed curriculum version (for linking to this class). */
  modules?: Module[]
  semesters: Semester[]
  /** The curriculum version this class is created in / belongs to (context, not editable). */
  curriculumVersionId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: ClassEntity): void
}>()

const isEdit = computed(() => !!props.classData?.id)

const form = ref<ClassEntity>(JSON.parse(JSON.stringify(emptyClass())))
const formRef = ref()

const semesterItems = computed(() =>
  (props.semesters || []).map(s => ({ id: s._id || s.id, title: s.name || s.code || '' }))
)

const degreeItems = computed(() =>
  (props.degrees || [])
    .map(d => ({ title: d.name || d.id || 'Unnamed', value: d.id }))
    .filter(d => d.value)
)

/** Modules of the displayed version that belong to the class's chosen degree. */
const moduleItems = computed(() =>
  (props.modules || [])
    .filter(m => (m.degreeIds ?? (m as any).degreeIDs ?? (m as any).DegreeIDs ?? []).includes(form.value.degreeId ?? ''))
    .map(m => ({ title: m.code ? `${m.code} — ${m.name || m.id}` : (m.name || m.id || ''), value: m.id || (m as any)._id }))
    .filter(i => i.value)
)

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.classData) {
      form.value = JSON.parse(JSON.stringify(props.classData))
      if (!form.value.curriculumVersionId) {
        form.value.curriculumVersionId = props.curriculumVersionId ?? ''
      }
    } else {
      form.value = JSON.parse(JSON.stringify({ ...emptyClass(), curriculumVersionId: props.curriculumVersionId ?? '' }))
    }
  }
})

// Changing the degree resets the module selection: modules of another degree
// would be silently invalid.
watch(() => form.value.degreeId, () => {
  form.value.moduleIds = []
})

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const result = JSON.parse(JSON.stringify(form.value))
  // The displayed version is the authoritative context on create; on edit the
  // class keeps its existing version (moving between versions is not
  // supported from here).
  if (!result.curriculumVersionId) result.curriculumVersionId = props.curriculumVersionId ?? ''
  if (!result.curriculumVersionId) {
    formRef.value?.validate()
    return
  }
  emit('save', result)
  close()
}
</script>