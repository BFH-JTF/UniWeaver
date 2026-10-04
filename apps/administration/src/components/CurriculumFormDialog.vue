<template>
  <v-dialog :model-value="modelValue" max-width="500" scrollable persistent @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-book-education" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">{{ isEdit ? 'Edit Curriculum' : 'New Curriculum' }}</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          {{ isEdit ? 'Edit curriculum details' : 'Create a new curriculum starting with an empty V1' }}
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
            placeholder="e.g. BSc Computer Science"
            class="mb-3"
          />

          <v-textarea
            v-model="form.description"
            label="Description"
            variant="outlined"
            density="compact"
            rows="3"
            auto-grow
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
import type { Curriculum } from '@/types/curriculum'

const props = defineProps<{
  modelValue: boolean
  curriculumData: Curriculum | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: Curriculum): void
}>()

const isEdit = computed(() => !!props.curriculumData?._id || !!props.curriculumData?.id)

const form = ref<Curriculum>({
  name: '',
  description: '',
})
const formRef = ref()

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    form.value = props.curriculumData
      ? JSON.parse(JSON.stringify(props.curriculumData))
      : { name: '', description: '' }
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
