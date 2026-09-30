<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon color="primary" size="36" class="mr-3">mdi-book-education</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Administration</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Curriculum and user administration</p>
      </div>
    </div>

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="rounded-lg elevation-2 h-100" hover @click="goToCurriculum">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-source-branch</v-icon>
            Curriculum Administration
          </v-card-title>
          <v-card-text>
            Manage curriculum versions, departments, programs, degrees, modules, classes, and semesters.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="text" prepend-icon="mdi-arrow-right">Open Curriculum</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col v-if="auth.isAdmin" cols="12" md="6">
        <v-card class="rounded-lg elevation-2 h-100" hover @click="goToUsers">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-account-group</v-icon>
            User Management
          </v-card-title>
          <v-card-text>
            Manage local users, OIDC identity mappings, and administrator rights.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="text" prepend-icon="mdi-arrow-right">Open Users</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function goToCurriculum(): void {
  router.push('/curriculum')
}

function goToUsers(): void {
  router.push('/users')
}
</script>
