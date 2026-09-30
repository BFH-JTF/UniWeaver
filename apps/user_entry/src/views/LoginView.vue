<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card class="card-lift pa-4">
          <div class="d-flex flex-column align-center mb-4">
            <img src="/Logo.png" class="login-logo" alt="UniWeaver">
            <p class="text-subtitle-2 text-medium-emphasis mt-3 mb-0 text-center">
              Curriculum, Scheduling &amp; Competencies
            </p>
          </div>

          <v-card-text>
            <div v-if="serverError" class="text-center mb-4">
              <v-alert type="warning" variant="tonal" class="mb-3">
                {{ serverError }}
              </v-alert>
            </div>

            <div v-else>
              <v-alert v-if="authError" type="error" density="compact" class="mb-3">
                {{ authError }}
              </v-alert>

              <v-btn
                color="primary"
                block
                size="large"
                :disabled="!authConfigLoaded"
                :loading="isLoggingIn"
                @click="handleLogin"
              >
                <v-icon start>mdi-login</v-icon>
                Log in with {{ providerName }}
              </v-btn>

              <v-alert v-if="redirectNotice" type="info" density="compact" class="mt-4" icon="mdi-lock">
                {{ redirectNotice }}
              </v-alert>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOidc } from '@/composables/useOidc'
import { useAuthStore } from '@/stores/auth'
import { api } from '@uniweaver/shared'

const route = useRoute()
const oidc = useOidc()
const auth = useAuthStore()

const authConfigLoaded = ref(false)
const serverError = ref('')
const providerName = ref('OIDC')
const authError = computed(() => auth.authError || oidc.error.value)

const isLoggingIn = ref(false)

const redirectNotice = computed(() => {
  const from = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return from ? `You need to log in to open ${from}.` : ''
})

async function handleLogin() {
  isLoggingIn.value = true
  auth.completeLoginFailure('')
  try {
    await oidc.login()
  } catch (err: any) {
    auth.completeLoginFailure(err?.message || 'Redirect to login failed')
  } finally {
    isLoggingIn.value = false
  }
}

onMounted(async () => {
  try {
    const config = await api.getAuthConfig()
    providerName.value = config.providerName || 'OIDC'
    authConfigLoaded.value = true
  } catch (err: any) {
    serverError.value = err.message || 'Backend is not reachable. Please try again later.'
  }
})
</script>
<style scoped>
.login-logo {
  height: 64px;
  width: auto;
  display: block;
}
</style>
