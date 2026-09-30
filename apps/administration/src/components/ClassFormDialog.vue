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
import type { Degree, Program } from '@/types/curriculum'
import type { Semester } from '@/stores/curriculum'
import { emptyClass } from '@/composables/useClasses'

const props = defineProps<{
  modelValue: boolean
  classData?: ClassEntity
  programs: Program[]
  degrees: Degree[]
  semesters: Semester[]
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

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.classData) {
      form.value = JSON.parse(JSON.stringify(props.classData))
    } else {
      form.value = JSON.parse(JSON.stringify(emptyClass()))
    }
  }
})

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  emit('save', JSON.parse(JSON.stringify(form.value)))
  close()
}
</script>