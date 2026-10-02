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
import type { Program, Department } from '@/types/curriculum'

const props = defineProps<{
  modelValue: boolean
  programData?: Program
  departments: Department[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [program: Program]
}>()

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
  }
})

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