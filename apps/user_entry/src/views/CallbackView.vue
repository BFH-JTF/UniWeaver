<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-card class="elevation-4 pa-4 rounded-lg">
          <v-card-title class="text-h5 text-center font-weight-bold">
            <v-icon color="success" class="mr-2">mdi-check-circle</v-icon>
            Sign-in complete
          </v-card-title>
          <v-card-text class="text-center">
            <template v-if="authError">
              <v-alert type="error" density="compact" class="mb-4">
                {{ authError }}
              </v-alert>
              <v-btn color="primary" variant="flat" @click="retry">Back to login</v-btn>
            </template>
            <template v-else>
              <v-progress-circular indeterminate color="primary" size="48" class="my-4" />
              <p class="text-body-1 mb-0">Establishing your session…</p>
            </template>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const processing = ref(false)
const localError = ref('')

const authError = computed(() => localError.value || auth.authError)

async function run() {
  if (processing.value) return
  processing.value = true
  try {
    const success = await auth.handleOidcCallback()
    if (success) {
      const requested = new URLSearchParams(window.location.search).get('redirect')
      const target = requested && requested.startsWith('/') ? requested : '/'
      await router.replace(target)
    } else {
      await router.replace({ name: 'login' })
    }
  } catch (err: any) {
    localError.value = err?.message || 'Login could not be completed'
  } finally {
    processing.value = false
  }
}

function retry() {
  localError.value = ''
  auth.completeLoginFailure('')
  router.replace({ name: 'login' })
}

onMounted(run)
</script>