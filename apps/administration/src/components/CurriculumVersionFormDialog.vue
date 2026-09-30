<template>
  <v-dialog :model-value="modelValue" max-width="500" scrollable persistent @update:model-value="$emit('update:modelValue', $event)">
    <v-card>
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-source-branch" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">{{ isEdit ? 'Edit Curriculum Version' : 'Add Curriculum Version' }}</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Create a new curriculum; programs are added within it afterwards
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
            placeholder="e.g. Studiengangsversion 2026"
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

          <v-text-field
            :model-value="form.versionNumber"
            label="Version Number"
            variant="outlined"
            density="compact"
            type="number"
            min="1"
            readonly
            hint="Automatically assigned as the next free version number"
            persistent-hint
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
import type { CurriculumVersion } from '@/stores/curriculum'
import { emptyCurriculumVersion } from '@/composables/useCurriculumVersions'

const props = defineProps<{
  modelValue: boolean
  versionData: CurriculumVersion | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: CurriculumVersion): void
}>()

const isEdit = computed(() => !!props.versionData?._id || !!props.versionData?.id)

const form = ref<CurriculumVersion>(JSON.parse(JSON.stringify(emptyCurriculumVersion())))
const formRef = ref()

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    form.value = props.versionData
      ? JSON.parse(JSON.stringify(props.versionData))
      : JSON.parse(JSON.stringify(emptyCurriculumVersion()))
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