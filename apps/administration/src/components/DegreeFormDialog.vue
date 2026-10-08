<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        {{ isEdit ? 'Edit Degree' : 'Add Degree' }}
        <CopyIdButton v-if="isEdit" :id="degree.id || degree._id" />
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="degree.name"
            label="Name *"
            :rules="[v => !!v || 'Name is required']"
          />
          <v-textarea
            v-model="degree.description"
            label="Description"
            rows="3"
            auto-grow
          />
          <v-select
            v-model="selectedProgramIds"
            :items="programItems"
            item-title="title"
            item-value="value"
            label="Programs of the displayed curriculum"
            multiple
            chips
            clearable
          />
          <v-text-field
            v-model="degree.contact"
            label="Contact"
          />
          <v-text-field
            v-model="degree.url"
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
import CopyIdButton from '@/components/CopyIdButton.vue'
import { useAuthStore } from '@/stores/auth'
import type { Degree, Program } from '@/types/curriculum'

const props = defineProps<{
  modelValue: boolean
  degreeData?: Degree
  programs: Program[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [degree: Degree]
}>()

const isEdit = computed(() => !!props.degreeData?.id)

const formRef = ref()
const degree = ref<Degree>(emptyDegree())

const selectedProgramIds = computed({
  get: () => degree.value.ProgramIDs ?? degree.value.programIDs ?? degree.value.programIds ?? [],
  set: (val: string[]) => {
    degree.value.ProgramIDs = val
    degree.value.programIDs = val
    degree.value.programIds = val
  },
})

const programItems = computed(() => {
  const auth = useAuthStore()
  // Non-global admins may only tie degrees to programs they administer.
  const selectable = auth.isAdmin ? props.programs : props.programs.filter(p => p._isAdmin)
  return selectable
    .map(p => ({
      title: p.name || p.id || 'Unnamed',
      value: p.id,
    }))
    .filter(p => p.value)
})

function emptyDegree(): Degree {
  return { name: '', ProgramIDs: [], programIDs: [], programIds: [] }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    degree.value = props.degreeData
      ? JSON.parse(JSON.stringify(props.degreeData))
      : emptyDegree()
  }
})

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  const result = JSON.parse(JSON.stringify(degree.value))
  const ids = result.ProgramIDs ?? result.programIDs ?? result.programIds ?? []
  result.ProgramIDs = ids
  result.programIDs = ids
  result.programIds = ids
  emit('save', result)
  emit('update:modelValue', false)
}
</script>