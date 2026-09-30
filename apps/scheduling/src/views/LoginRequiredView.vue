<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card class="elevation-4 pa-4 rounded-lg">
          <v-card-title class="text-h5 text-center font-weight-bold">
            <v-icon color="warning" class="mr-2">mdi-lock</v-icon>
            Login required
          </v-card-title>
          <v-card-subtitle class="text-center mb-4">UniWeaver Scheduling</v-card-subtitle>
          <v-card-text class="text-center">
            <v-alert type="info" variant="tonal" class="mb-4">
              You need to sign in before using this tool.
            </v-alert>
            <v-btn color="primary" variant="flat" :href="loginUrl() + '/login'">
              <v-icon start>mdi-login</v-icon>
              Go to login
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { userEntryUrl as loginUrl } from '../config'
</script>
