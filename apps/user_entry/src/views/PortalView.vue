<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" md="10" lg="9">
        <div class="view-hero mb-6">
          <div class="d-flex align-center justify-space-between hero-row">
            <div class="d-flex align-center ga-4 hero-brand">
              <img src="/Logo.png" class="hero-logo" alt="UniWeaver">
              <div class="hero-text">
                <h1 class="text-h5 font-weight-bold mb-1">Welcome, {{ auth.userName }}</h1>
                <p class="text-body-2 mb-0 hero-subtitle">
                  Choose one of the UniWeaver tools to continue.
                </p>
              </div>
            </div>
            <div class="d-flex align-center ga-3">
              <v-chip
                variant="flat"
                color="rgba(255, 255, 255, 0.18)"
                class="text-white font-weight-bold"
              >
                <v-icon start size="16">{{ auth.isAdmin ? 'mdi-shield-crown' : 'mdi-account' }}</v-icon>
                {{ auth.isAdmin ? 'Administrator' : 'User' }}
              </v-chip>
              <v-btn
                icon
                variant="text"
                color="white"
                :disabled="updatingLecturerFlag"
                @click="toggleLecturerOptOut"
              >
                <v-icon>{{ isNotLecturer ? 'mdi-account-off-outline' : 'mdi-account-check-outline' }}</v-icon>
                <v-tooltip activator="parent" location="bottom">
                  {{ isNotLecturer
                    ? 'You are not listed as a lecturer - click to appear in lecturer lists again'
                    : 'You are listed as a lecturer - click to remove yourself from lecturer lists' }}
                </v-tooltip>
              </v-btn>
              <v-btn icon variant="text" color="white" @click="handleLogout">
                <v-icon>mdi-logout</v-icon>
                <v-tooltip activator="parent">Logout</v-tooltip>
              </v-btn>
            </div>
          </div>
        </div>

        <v-alert v-if="error" type="error" closable class="mb-4" @click:close="error = ''">
          {{ error }}
        </v-alert>

        <v-snackbar v-model="flagSnackbar" :color="flagSnackbarColor" :timeout="4000">
          {{ flagSnackbarText }}
        </v-snackbar>

        <v-card v-if="auth.bootstrapRequired" class="card-lift mb-6">
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
            <v-card class="card-lift fill-height d-flex flex-column" hover>
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
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@uniweaver/shared'
import { DEFAULT_TOOL_LINKS } from '@uniweaver/shared'
import { toolUrl } from '@/config'
import type { ToolRoute } from '@uniweaver/shared'

const auth = useAuthStore()
const error = ref('')

const bootstrapSecret = ref('')
const showSecret = ref(false)
const isBootstrapping = ref(false)

const updatingLecturerFlag = ref(false)
const flagSnackbar = ref(false)
const flagSnackbarText = ref('')
const flagSnackbarColor = ref('success')

const isNotLecturer = computed(() => !!auth.localUser?.is_not_lecturer)

async function toggleLecturerOptOut(): Promise<void> {
  if (updatingLecturerFlag.value) return
  updatingLecturerFlag.value = true
  error.value = ''
  try {
    const updated = await api.updateMyProfile({ is_not_lecturer: !isNotLecturer.value })
    auth.localUser = updated
    flagSnackbarText.value = isNotLecturer.value
      ? 'You are no longer listed as a lecturer.'
      : 'You are now listed as a lecturer again.'
    flagSnackbarColor.value = 'success'
    flagSnackbar.value = true
  } catch (err: any) {
    flagSnackbarText.value = err.message || 'Failed to update your lecturer status'
    flagSnackbarColor.value = 'error'
    flagSnackbar.value = true
  } finally {
    updatingLecturerFlag.value = false
  }
}

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
<style scoped>
.hero-row {
  gap: 16px;
  flex-wrap: wrap;
}
.hero-brand {
  min-width: 0;
}
.hero-logo {
  height: 38px;
  width: auto;
  display: block;
  flex-shrink: 0;
}
.hero-text {
  min-width: 0;
}
.hero-subtitle {
  opacity: 0.85;
}
@media (max-width: 959px) {
  .hero-logo {
    height: 30px;
  }
}
</style>
