import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ApiRequestError } from '@uniweaver/shared'
import type { LocalUserProfile } from '@uniweaver/shared'
import { useOidc } from '@/composables/useOidc'

export const useAuthStore = defineStore('auth', () => {
  const oidc = useOidc()

  const localUser = ref<LocalUserProfile | null>(null)
  const bootstrapRequired = ref(false)
  const authError = ref('')
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!localUser.value)
  const isAdmin = computed(() => !!localUser.value?.is_admin)
  const userName = computed(() => localUser.value?.display_name || localUser.value?.name || 'User')

  async function initAuth(): Promise<boolean> {
    if (initialized.value) return isAuthenticated.value
    initialized.value = true

    try {
      const res = await api.me()
      localUser.value = res.user
      bootstrapRequired.value = !!res.bootstrapRequired
      return !!res.user
    } catch (err: any) {
      localUser.value = null
      bootstrapRequired.value = false
      if (err instanceof ApiRequestError && err.status !== 401) {
        console.warn('Session check failed:', err.message)
      }
      return false
    }
  }

  async function handleOidcCallback(): Promise<boolean> {
    authError.value = ''
    const idToken = await oidc.handleCallback()
    if (!idToken) {
      authError.value = oidc.error.value || 'Login failed: no ID token received'
      return false
    }
    return completeLogin(idToken)
  }

  async function completeLogin(idToken: string): Promise<boolean> {
    authError.value = ''
    try {
      const res = await api.createSession(idToken)
      // The login always completes on its own. A pending bootstrap only means
      // the user may additionally elevate itself to administrator afterwards.
      bootstrapRequired.value = !!res.bootstrapRequired
      localUser.value = res.user
      return !!res.user
    } catch (err: any) {
      authError.value = err.message || 'Failed to establish session'
      return false
    }
  }

  function completeLoginFailure(message: string): void {
    authError.value = message
  }

  async function checkBootstrapStatus(): Promise<boolean> {
    try {
      const status = await api.bootstrapStatus()
      return status.bootstrapRequired
    } catch {
      return false
    }
  }

  async function submitBootstrap(secret: string): Promise<boolean> {
    authError.value = ''
    try {
      const res = await api.bootstrapAdmin(secret)
      bootstrapRequired.value = false
      localUser.value = res.user
      return true
    } catch (err: any) {
      authError.value = err.message || 'Bootstrap failed'
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.logout()
    } catch {
      // destroying the session server-side is best effort
    }
    localUser.value = null
    bootstrapRequired.value = false
    // Delegate the provider-side SSO teardown to useOidc's signoutRedirect.
    // This navigates away; nothing after it reliably runs.
    await oidc.logout()
  }

  return {
    localUser,
    bootstrapRequired,
    authError,
    initialized,
    isAuthenticated,
    isAdmin,
    userName,
    initAuth,
    handleOidcCallback,
    completeLogin,
    completeLoginFailure,
    checkBootstrapStatus,
    submitBootstrap,
    logout,
  }
})