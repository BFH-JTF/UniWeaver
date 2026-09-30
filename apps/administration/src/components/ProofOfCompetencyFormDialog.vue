<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="650" persistent>
    <v-card>
      <v-card-title class="text-h6 font-weight-bold">
        {{ isEdit ? 'Edit Proof of Competency' : 'Add Proof of Competency' }}
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="proof.name"
            label="Name *"
            placeholder="e.g., Final Written Exam, Project Presentation"
            :rules="[v => !!v || 'Name is required']"
            variant="outlined"
            density="compact"
            class="mb-3"
          />

          <v-textarea
            v-model="proof.description"
            label="Description"
            placeholder="Assessment guidelines, coverage, or requirements..."
            rows="3"
            auto-grow
            variant="outlined"
            density="compact"
            class="mb-3"
          />

          <v-row dense>
            <v-col cols="12" sm="6">
              <v-select
                v-model="proof.answerFormats"
                :items="answerFormatOptions"
                label="Answer Formats"
                hint="A proof may mix formats, e.g. multiple choice + free text"
                persistent-hint
                variant="outlined"
                density="compact"
                multiple
                chips
                closable-chips
                clearable
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-select
                v-model="proof.assignmentScope"
                :items="assignmentScopeOptions"
                label="Assignment Type (Individual / Group)"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>

          <v-row dense class="mt-1">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="proof.durationMinutes"
                label="Duration of Test (minutes)"
                placeholder="e.g. 90"
                type="number"
                min="0"
                suffix="min"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">{{ isEdit ? 'Save' : 'Add' }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ProofOfCompetency, AnswerFormat } from '@/types/proofOfCompetency'

const props = defineProps<{
  modelValue: boolean
  proofData?: ProofOfCompetency
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [proof: ProofOfCompetency]
}>()

const isEdit = computed(() => !!props.proofData?.id)

const formRef = ref()
const proof = ref<ProofOfCompetency>(emptyProof())

const answerFormatOptions: { title: string; value: AnswerFormat }[] = [
  { title: 'Written', value: 'written' },
  { title: 'Oral', value: 'oral' },
  { title: 'Multiple Choice', value: 'multipleChoice' },
  { title: 'Free Text', value: 'freeText' },
]

const assignmentScopeOptions = [
  { title: 'Individual', value: 'individual' },
  { title: 'Group Assignment', value: 'group' },
]

function emptyProof(): ProofOfCompetency {
  return {
    name: '',
    description: '',
    answerFormats: [],
    assignmentScope: 'individual',
    durationMinutes: undefined,
    competencyIds: [],
  }
}

watch(() => props.modelValue, (val) => {
  if (val) {
    proof.value = props.proofData
      ? JSON.parse(JSON.stringify(props.proofData))
      : emptyProof()
  }
})

async function submit() {
  const { valid } = await formRef.value?.validate() ?? { valid: false }
  if (!valid) return
  emit('save', JSON.parse(JSON.stringify(proof.value)))
  emit('update:modelValue', false)
}
</script>