<template>
  <v-card variant="outlined" class="mt-2">
    <v-card-title class="d-flex align-center py-2 px-4 text-subtitle-2">
      <v-icon icon="mdi-source-branch" size="small" class="me-2" />
      Versions
      <v-spacer />
      <v-btn
        v-if="canEdit"
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-plus"
        @click="$emit('add-version')"
      >
        Add Version
      </v-btn>
    </v-card-title>

    <v-divider />

    <v-data-table
      :items="versions"
      :headers="headers"
      density="compact"
      hide-default-footer
      class="text-body-2"
    >
      <template #[`item.versionNumber`]="{ item }">
        <span class="font-weight-medium">V{{ item.versionNumber }}</span>
        <v-chip
          v-if="item._id === activeVersionId || item.id === activeVersionId"
          size="x-small"
          color="success"
          variant="tonal"
          class="ml-2"
        >
          Active
        </v-chip>
      </template>

      <template #[`item.name`]="{ item }">
        {{ item.name || '—' }}
      </template>

      <template #[`item.semesterId`]="{ item }">
        {{ semesterName(item.semesterId) }}
      </template>

      <template #[`item.createdByName`]="{ item }">
        {{ item.createdByName || '—' }}
      </template>

      <template #[`item.createdAt`]="{ item }">
        {{ formatDate(item.createdAt) }}
      </template>

      <template #[`item.actions`]="{ item }">
        <v-btn
          icon="mdi-view-dashboard-outline"
          size="small"
          variant="text"
          color="primary"
          title="Manage content (programs, degrees, modules, classes)"
          @click="$emit('manage', item)"
        />
        <v-btn
          v-if="canEdit && (item._id !== activeVersionId && item.id !== activeVersionId)"
          icon="mdi-star-outline"
          size="small"
          variant="text"
          color="primary"
          title="Set as Active"
          @click="$emit('set-active', item)"
        />
        <v-btn
          v-if="canEdit"
          icon="mdi-pencil"
          size="small"
          variant="text"
          title="Edit"
          @click="$emit('edit', item)"
        />
        <v-btn
          v-if="canEdit"
          icon="mdi-delete"
          size="small"
          variant="text"
          color="error"
          title="Delete"
          @click="$emit('delete', item)"
        />
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
import type { CurriculumVersion } from '@/types/curriculum'

const props = defineProps<{
  versions: CurriculumVersion[]
  activeVersionId?: string
  canEdit: boolean
  semesters: Array<{ _id?: string; id?: string; name?: string; code?: string }>
}>()

defineEmits<{
  (e: 'add-version'): void
  (e: 'manage', version: CurriculumVersion): void
  (e: 'set-active', version: CurriculumVersion): void
  (e: 'edit', version: CurriculumVersion): void
  (e: 'delete', version: CurriculumVersion): void
}>()

const headers = [
  { title: 'Version', key: 'versionNumber', width: '100px' },
  { title: 'Name', key: 'name' },
  { title: 'Semester', key: 'semesterId' },
  { title: 'Created By', key: 'createdByName' },
  { title: 'Created', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false, width: '150px' },
]

function semesterName(semesterId?: string): string {
  if (!semesterId) return '—'
  const s = props.semesters.find(x => (x.id || x._id) === semesterId)
  return s?.name || s?.code || '—'
}

function formatDate(date?: string): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString()
  } catch {
    return '—'
  }
}
</script>
