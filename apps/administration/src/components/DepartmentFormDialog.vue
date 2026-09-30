<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit Department' : 'Add Department' }}</v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="department.name"
            label="Name *"
            :rules="[v => !!v || 'Name is required']"
          />
          <v-textarea
            v-model="department.description"
            label="Description"
            rows="3"
            auto-grow
          />
          <v-text-field
            v-model="department.contact"
            label="Contact"
          />
          <v-text-field
            v-model="department.url"
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
import type { Department } from '@/types/curriculum'

const props = defineProps<{
  modelValue: boolean
  departmentData?: Department
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [department: Department]
}>()

const isEdit = computed(() => !!props.departmentData?.id)

const formRef = ref()
const department = ref<Department>(emptyDepartment())

function emptyDepartment(): Department {
  return { name: '' }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    department.value = props.departmentData
      ? JSON.parse(JSON.stringify(props.departmentData))
      : emptyDepartment()
  }
})

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  emit('save', JSON.parse(JSON.stringify(department.value)))
  emit('update:modelValue', false)
}
</script>