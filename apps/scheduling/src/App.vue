<template>
  <v-app>
    <v-app-bar color="primary" prominent>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>UniWeaver Scheduling</v-app-bar-title>
      <v-spacer />

      <div v-if="auth.isAuthenticated" class="d-flex align-center me-2">
        <v-chip
          variant="flat"
          color="rgba(255, 255, 255, 0.18)"
          class="text-white font-weight-medium px-3"
        >
          <v-icon start size="18">{{ auth.isAdmin ? 'mdi-shield-crown' : 'mdi-account-circle' }}</v-icon>
          <span class="text-truncate" style="max-width: 180px;">{{ auth.userName }}</span>
          <v-tooltip activator="parent" location="bottom">
            Logged in as {{ auth.userName }} ({{ auth.isAdmin ? 'Administrator' : 'User' }})
          </v-tooltip>
        </v-chip>
      </div>

      <v-btn icon @click="handleLogout" v-if="auth.isAuthenticated">
        <v-icon>mdi-logout</v-icon>
        <v-tooltip activator="parent">Logout</v-tooltip>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" temporary>
      <v-list nav>
        <v-list-item
          v-if="auth.isAuthenticated"
          :prepend-icon="auth.isAdmin ? 'mdi-shield-crown' : 'mdi-account-circle'"
          :title="auth.userName"
          :subtitle="auth.isAdmin ? 'Administrator' : 'User'"
          class="mb-2"
        />
        <v-divider v-if="auth.isAuthenticated" class="mb-2" />
        <v-list-item to="/" prepend-icon="mdi-home" title="Home" />
        <v-list-item href="#" target="_self" prepend-icon="mdi-arrow-left" title="Back to User Portal" @click.prevent="backToPortal" />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'
import { userEntryUrl } from './config'

const drawer = ref(false)
const auth = useAuthStore()
const { logout } = useAuth()

function backToPortal(): void {
  window.location.href = userEntryUrl()
}

async function handleLogout(): Promise<void> {
  await logout()
}
</script>
