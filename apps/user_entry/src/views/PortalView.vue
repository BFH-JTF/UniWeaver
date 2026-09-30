<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" md="10" lg="9">
        <div class="d-flex align-center justify-space-between mb-6">
          <div>
            <h1 class="text-h4 font-weight-bold">Welcome, {{ auth.userName }}</h1>
            <p class="text-subtitle-1 text-medium-emphasis mb-0">
              Choose one of the UniWeaver tools to continue.
            </p>
          </div>
          <div class="d-flex align-center ga-2">
            <v-chip
              :color="auth.isAdmin ? 'primary' : 'default'"
              variant="flat"
              size="small"
              class="font-weight-bold"
            >
              <v-icon start size="16">{{ auth.isAdmin ? 'mdi-shield-crown' : 'mdi-account' }}</v-icon>
              {{ auth.isAdmin ? 'Administrator' : 'User' }}
            </v-chip>
            <v-btn icon variant="text" @click="handleLogout">
              <v-icon>mdi-logout</v-icon>
              <v-tooltip activator="parent">Logout</v-tooltip>
            </v-btn>
          </div>
        </div>

        <v-alert v-if="error" type="error" closable class="mb-4" @click:close="error = ''">
          {{ error }}
        </v-alert>

        <v-card v-if="auth.bootstrapRequired" class="rounded-lg elevation-2 mb-6">
          <v-card-title class="d-flex align-center">
            <v-icon start color="primary">mdi-shield-crown</v-icon>
            First-Time Deployment Bootstrap
          </v-card-title>
          <v-card-text>
            <p class="mb-4">
              You are signed in as a regular user. No administrator account exists yet – enter the deployment
              <code>BOOTSTRAP_ADMIN_SECRET</code> to elevate your account to administrator.
            </p>

            <v-alert v-if="auth.authError" type="error" density="compact" class="mb-3">
              {{ auth.authError }}
            </v-alert>

            <v-form @submit.prevent="handleBootstrapSubmit">
              <v-text-field
                v-model="bootstrapSecret"
                label="Bootstrap Admin Secret"
                placeholder="Enter BOOTSTRAP_ADMIN_SECRET"
                variant="outlined"
                density="comfortable"
                :type="showSecret ? 'text' : 'password'"
                :append-inner-icon="showSecret ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showSecret = !showSecret"
                class="mb-3"
                required
              />

              <v-btn
                color="primary"
                variant="flat"
                :loading="isBootstrapping"
                :disabled="!bootstrapSecret.trim()"
                type="submit"
              >
                <v-icon start>mdi-shield-check</v-icon>
                Become Administrator
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <v-row>
          <v-col v-for="tool in tools" :key="tool.key" cols="12" md="4">
            <v-card class="rounded-lg elevation-2 fill-height d-flex flex-column" hover>
              <v-card-title class="d-flex align-center">
                <v-icon start color="primary">{{ tool.icon }}</v-icon>
                {{ tool.title }}
              </v-card-title>
              <v-card-text class="flex-grow-1">
                {{ tool.description }}
              </v-card-text>
              <v-card-actions>
                <v-btn
                  v-if="tool.key !== 'administration' || auth.isAdmin"
                  color="primary"
                  variant="flat"
                  block
                  @click="openTool(tool.key)"
                >
                  Open
                  <v-icon end>mdi-arrow-right</v-icon>
                </v-btn>
                <v-chip
                  v-else
                  color="default"
                  variant="tonal"
                  size="small"
                  class="mx-auto mb-2 font-weight-bold"
                >
                  Admin only
                </v-chip>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_TOOL_LINKS } from '@uniweaver/shared'
import { toolUrl } from '@/config'
import type { ToolRoute } from '@uniweaver/shared'

const auth = useAuthStore()
const error = ref('')

const bootstrapSecret = ref('')
const showSecret = ref(false)
const isBootstrapping = ref(false)

const tools = DEFAULT_TOOL_LINKS

async function handleBootstrapSubmit() {
  isBootstrapping.value = true
  try {
    const success = await auth.submitBootstrap(bootstrapSecret.value.trim())
    if (success) {
      bootstrapSecret.value = ''
    }
  } finally {
    isBootstrapping.value = false
  }
}

function openTool(tool: ToolRoute) {
  window.location.href = toolUrl(tool)
}

async function handleLogout() {
  // auth.logout() redirects to the provider's end-session endpoint; the
  // navigation to the login page happens via post_logout_redirect_uri.
  await auth.logout()
}
</script>