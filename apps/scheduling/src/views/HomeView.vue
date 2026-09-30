<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon :color="'primary'" size="36" class="mr-3">mdi-calendar-clock</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Scheduling</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Semester schedule generation</p>
      </div>
    </div>

    <v-alert type="info" variant="tonal" icon="mdi-information-outline">
      This tool is not yet implemented. The foundation (authentication, shared backend, and data model)
      is in place; scheduling functionality will be built next.
    </v-alert>
  </v-container>
</template>

<script setup lang="ts">
</script>
