<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card>
      <v-card-title>{{ isEdit ? 'Edit Competency' : 'Add Competency' }}</v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="competency.name"
            label="Name *"
            :rules="[v => !!v || 'Name is required']"
          />
          <v-combobox
            v-model="competency.category"
            :items="categorySuggestions"
            label="Category"
            clearable
          />
          <v-select
            v-model="competency.level"
            :items="levelOptions"
            label="Level"
            clearable
          />
          <v-textarea
            v-model="competency.description"
            label="Description"
            rows="3"
            auto-grow
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
import type { Competency } from '@/types/competency'

const props = defineProps<{
  modelValue: boolean
  competencyData?: Competency
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [competency: Competency]
}>()

const isEdit = computed(() => !!props.competencyData?.id)

const formRef = ref()
const competency = ref<Competency>(emptyCompetency())

const categorySuggestions = [
  'Knowledge Area',
  'Subject-Specific Skill',
  'Generic Skill',
]

const levelOptions = [
  { title: 'Introduction (I)', value: 'Introduction' },
  { title: 'Regular (R)', value: 'Regular' },
  { title: 'Master (M)', value: 'Master' },
]

function emptyCompetency(): Competency {
  return {
    name: '',
    category: '',
    description: '',
    level: undefined,
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    competency.value = props.competencyData
      ? JSON.parse(JSON.stringify(props.competencyData))
      : emptyCompetency()
  }
})

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  emit('save', JSON.parse(JSON.stringify(competency.value)))
  emit('update:modelValue', false)
}
</script>
