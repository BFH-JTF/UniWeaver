import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LocalUserProfile } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'

export const useAuthStore = defineStore('auth', () => {
  const localUser = ref<LocalUserProfile | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!localUser.value)
  const isAdmin = computed(() => !!localUser.value?.is_admin)
  const canSchedule = computed(() => isAdmin.value || !!localUser.value?.is_scheduler)
  const userName = computed(() => localUser.value?.display_name || localUser.value?.name || 'User')

  async function initAuth(): Promise<boolean> {
    if (initialized.value) return isAuthenticated.value
    initialized.value = true
    try {
      const res = await api.me()
      localUser.value = res.user
      return !!localUser.value
    } catch {
      localUser.value = null
      return false
    }
  }

  function clearUser(): void {
    localUser.value = null
  }

  return { localUser, initialized, isAuthenticated, isAdmin, canSchedule, userName, initAuth, clearUser }
})
