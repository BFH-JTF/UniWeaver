<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon color="primary" size="36" class="mr-3">mdi-format-list-bulleted-type</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Module / Lecturer Mapping</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Assign lecturers to modules</p>
      </div>
    </div>

    <v-alert
      v-if="!auth.canSchedule"
      type="warning"
      variant="tonal"
      icon="mdi-lock-outline"
    >
      Scheduler permission required. Ask an administrator to grant you the Scheduler role
      to edit the module / lecturer mapping.
    </v-alert>

    <template v-else>
      <div v-if="loading && !mapping" class="d-flex align-center py-8">
        <v-progress-circular indeterminate color="primary" size="32" class="mr-3" />
        <span class="text-medium-emphasis">Loading mapping data...</span>
      </div>

      <v-alert v-else-if="loadError" type="error" variant="tonal" class="mb-4" closable @click:close="loadError = ''">
        {{ loadError }}
      </v-alert>

      <v-tabs v-else v-model="tab" color="primary" class="mb-4">
        <v-tab value="editor" prepend-icon="mdi-view-edit">Editor</v-tab>
        <v-tab value="matrix" prepend-icon="mdi-grid-large">Matrix</v-tab>
      </v-tabs>

      <v-window v-if="mapping" v-model="tab">
        <v-window-item value="editor">
          <MappingEditor :mapping="mapping" @reload="reload" />
        </v-window-item>
        <v-window-item value="matrix">
          <MappingMatrix :mapping="mapping" @reload="reload" />
        </v-window-item>
      </v-window>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { MappingData } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'
import { useAuthStore } from '@/stores/auth'
import MappingEditor from '@/components/MappingEditor.vue'
import MappingMatrix from '@/components/MappingMatrix.vue'

const auth = useAuthStore()
const tab = ref('editor')
const mapping = ref<MappingData | null>(null)
const loading = ref(false)
const loadError = ref('')

async function reload(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    mapping.value = await api.getMapping()
  } catch (err: any) {
    loadError.value = err.message || 'Failed to load mapping data'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (auth.canSchedule) {
    await reload()
  }
})
</script>