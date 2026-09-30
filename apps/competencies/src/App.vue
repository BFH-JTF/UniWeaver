<template>
  <v-app>
    <v-app-bar color="primary" prominent elevation="2" :elevation-h="6">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>
        <img src="/Logo.png" class="bar-logo" alt="UniWeaver Competencies">
      </v-app-bar-title>
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
      <div class="brand">
        <img src="/Logo.png" class="brand-logo" alt="UniWeaver" >
      </div>

      <v-list nav>
        <v-list-item to="/" prepend-icon="mdi-home" title="Home" />
      </v-list>

      <template #append>
        <div class="user-card" @click="userMenuOpen = !userMenuOpen">
          <span class="avatar">{{ initials }}</span>
          <div class="user-info">
            <div class="user-name">{{ auth.userName || 'Unbekannt' }}</div>
            <div class="user-sub">{{ auth.isAdmin ? 'Administration' : 'BFH' }}</div>
          </div>
          <v-icon size="small" color="grey">mdi-chevron-down</v-icon>
        </div>
        <div v-if="userMenuOpen" class="user-menu">
          <div class="user-role-label">
            Rolle: {{ auth.isAdmin ? 'Administrator' : 'Benutzer' }}
          </div>
          <v-btn size="small" class="mb-2" block variant="tonal" color="error" @click="handleLogout">
            Abmelden
          </v-btn>
        </div>
        <v-list-item
          href="#"
          target="_self"
          prepend-icon="mdi-arrow-left"
          title="Back to User Portal"
          @click.prevent="backToPortal"
        />
      </template>
    </v-navigation-drawer>

    <v-main class="app-bg">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'
import { userEntryUrl } from './config'

const drawer = ref(false)
const userMenuOpen = ref(false)
const auth = useAuthStore()
const { logout } = useAuth()

const initials = computed(() => {
  const parts = (auth.userName || 'Uni Weaver').split(' ')
  const a = parts[0]?.[0] ?? 'U'
  const b = parts[1]?.[0] ?? ''
  return (a + b).toUpperCase()
})

function backToPortal(): void {
  window.location.href = userEntryUrl()
}

async function handleLogout(): Promise<void> {
  await logout()
}
</script>

<style scoped>
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 20px;
  font-weight: 700;
  font-size: 16px;
}
.brand:hover {
  background: rgba(25, 118, 210, 0.08);
}
.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  cursor: pointer;
  margin: 8px;
}
.user-card:hover {
  background: rgba(25, 118, 210, 0.06);
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1976d2;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 13px; font-weight: 600; line-height: 1.1; }
.user-sub {
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  margin: 0 8px 4px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.user-role-label {
  padding: 8px 10px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
}
</style>
