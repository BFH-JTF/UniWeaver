<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon color="primary" size="36" class="mr-3">mdi-calendar-clock</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">Scheduling</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">Semester schedule generation</p>
      </div>
    </div>

    <v-row>
      <v-col cols="12" md="3">
        <v-card class="rounded-lg elevation-2 h-100" hover @click="goToMapping">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-format-list-bulleted-type</v-icon>
            Module / Lecturer Mapping
          </v-card-title>
          <v-card-text>
            Assign lecturers to modules and define who teaches which class.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="text" prepend-icon="mdi-arrow-right">Open Mapping</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card class="rounded-lg elevation-2 h-100" hover @click="goToRooms">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-door-open</v-icon>
            Rooms
          </v-card-title>
          <v-card-text>
            Manage rooms, their capacities, equipment, and availability.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="text" prepend-icon="mdi-arrow-right">Open Rooms</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card class="rounded-lg elevation-2 h-100" hover @click="goToAvailability">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-calendar-clock-outline</v-icon>
            Lecturer Availability
          </v-card-title>
          <v-card-text>
            Maintain lecturer time windows, blackout periods, and semester constraints.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="text" prepend-icon="mdi-arrow-right">Open Availability</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card class="rounded-lg elevation-2 h-100" hover @click="goToSchedules">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-calendar-multiple-check</v-icon>
            Schedules
          </v-card-title>
          <v-card-text>
            Generate the semester schedule from module, class, room, and lecturer data.
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" variant="text" prepend-icon="mdi-arrow-right">Open Schedules</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goToMapping(): void {
  router.push('/mapping')
}

function goToRooms(): void {
  router.push('/rooms')
}

function goToAvailability(): void {
  router.push('/availability')
}

function goToSchedules(): void {
  router.push('/schedules')
}
</script>