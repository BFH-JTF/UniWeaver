#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs'
import path from 'path'

const apps: Array<{ slug: string; title: string; port: number; description: string; icon: string }> = [
  {
    slug: 'administration',
    title: 'UniWeaver Administration',
    port: 5174,
    description: 'Curriculum administration',
    icon: 'mdi-book-education',
  },
  {
    slug: 'scheduling',
    title: 'UniWeaver Scheduling',
    port: 5175,
    description: 'Semester schedule generation',
    icon: 'mdi-calendar-clock',
  },
  {
    slug: 'competencies',
    title: 'UniWeaver Competencies',
    port: 5176,
    description: 'Competency mapping and scheduling',
    icon: 'mdi-map-legend',
  },
]

const root = path.resolve(import.meta.dirname, '..', 'apps')
const appsRoot = path.resolve(import.meta.dirname, '..')

for (const app of apps) {
  const dir = path.join(root, app.slug)
  const pascalName = app.slug.charAt(0).toUpperCase() + app.slug.slice(1)

  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: `@uniweaver/${app.slug}`,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      dev: `vite --port ${app.port}`,
      build: 'vue-tsc -b && vite build',
      typecheck: 'vue-tsc --noEmit',
      preview: 'vite preview',
    },
    dependencies: {
      '@mdi/font': '^7.4.47',
      '@uniweaver/shared': '*',
      'pinia': '^4.0.3',
      'vue': '^3.5.42',
      'vue-router': '^4.6.4',
      'vuetify': '^4.2.1',
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^6.0.9',
      'typescript': '~5.7',
      'vite': '^8.3.0',
      'vite-plugin-vuetify': '^2.1.3',
      'vue-tsc': '^2.2.12',
    },
  }, null, 2))

  writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      jsx: 'preserve',
      baseUrl: '.',
      paths: { '@/*': ['src/*'] },
      types: ['vite/client'],
    },
    include: ['src/**/*.ts', 'src/**/*.vue', 'env.d.ts'],
  }, null, 2))

  writeFileSync(path.join(dir, 'env.d.ts'), `/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
`)

  writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${app.title}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`)

  writeFileSync(path.join(dir, 'vite.config.ts'), `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/${app.slug}/',
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
`)

  cpSync(
    path.join(appsRoot, 'apps/user_entry/src/plugins/vuetify.ts'),
    path.join(dir, 'src/plugins/vuetify.ts'),
  )

  writeFileSync(path.join(dir, 'src/main.ts'), `import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './router'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(vuetify)
app.use(router)
app.mount('#app')
`)

  writeFileSync(path.join(dir, 'src/App.vue'), `<template>
  <v-app>
    <v-app-bar color="primary" prominent>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>${app.title}</v-app-bar-title>
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

      <v-btn icon to="/login" v-if="auth.isAuthenticated">
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
        <v-list-item :to="'/user_entry'" :prepend-icon="'mdi-home'" title="Back to User Portal" />
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

const drawer = ref(false)
const auth = useAuthStore()
const { logout } = useAuth()
</script>
`)

  mkdirSync(path.join(dir, 'src/composables'), { recursive: true })

  writeFileSync(path.join(dir, 'src/stores/auth.ts'), `import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { LocalUserProfile } from '@uniweaver/shared'
import { api } from '@uniweaver/shared'

export const useAuthStore = defineStore('auth', () => {
  const localUser = ref<LocalUserProfile | null>(null)
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
      return !!localUser.value
    } catch {
      localUser.value = null
      return false
    }
  }

  function clearUser(): void {
    localUser.value = null
  }

  return { localUser, initialized, isAuthenticated, isAdmin, userName, initAuth, clearUser }
})
`)

  writeFileSync(path.join(dir, 'src/composables/useAuth.ts'), `import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { USER_ENTRY_URL } from '../config'

export function useAuth() {
  const router = useRouter()
  const auth = useAuthStore()

  async function ensureAuth(): Promise<boolean> {
    const ok = await auth.initAuth()
    if (!ok) {
      window.location.href = \`\${USER_ENTRY_URL}/login?redirect=\${encodeURIComponent(window.location.pathname)}\`
    }
    return ok
  }

  async function logout(): Promise<void> {
    await apiSafeLogout()
    auth.clearUser()
    router.push('/login')
  }

  async function apiSafeLogout(): Promise<void> {
    const { api } = await import('@uniweaver/shared')
    try {
      await api.logout()
    } catch {
      // session teardown is best effort
    }
  }

  return { ensureAuth, logout }
}
`)

  writeFileSync(path.join(dir, 'src/config.ts'), `export const USER_ENTRY_URL = import.meta.env.USER_ENTRY_URL || 'http://localhost:5173'
`)

  writeFileSync(path.join(dir, 'src/router/index.ts'), `import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginRequiredView.vue'),
      meta: { public: true },
    },
    {
      path: '',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const { useAuthStore } = await import('@/stores/auth')
  const { useAuth } = await import('@/composables/useAuth')
  const auth = useAuthStore()
  const { ensureAuth } = useAuth()

  const ok = await ensureAuth()
  if (!ok) return false
  return true
})

export default router
`)

  writeFileSync(path.join(dir, 'src/views/LoginRequiredView.vue'), `<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="5">
        <v-card class="elevation-4 pa-4 rounded-lg">
          <v-card-title class="text-h5 text-center font-weight-bold">
            <v-icon color="warning" class="mr-2">mdi-lock</v-icon>
            Login required
          </v-card-title>
          <v-card-subtitle class="text-center mb-4">${app.title}</v-card-subtitle>
          <v-card-text class="text-center">
            <v-alert type="info" variant="tonal" class="mb-4">
              You need to sign in before using this tool.
            </v-alert>
            <v-btn color="primary" variant="flat" :href="loginUrl + '/login'">
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
import { USER_ENTRY_URL as loginUrl } from '../config'
</script>
`)

  writeFileSync(path.join(dir, 'src/views/HomeView.vue'), `<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon :color="'primary'" size="36" class="mr-3">${app.icon}</v-icon>
      <div>
        <h1 class="text-h4 font-weight-bold mb-0">${pascalName}</h1>
        <p class="text-subtitle-1 text-medium-emphasis mb-0">${app.description}</p>
      </div>
    </div>

    <v-alert type="info" variant="tonal" icon="mdi-information-outline">
      This tool is not yet implemented. The foundation (authentication, shared backend, and data model)
      is in place; ${app.slug} functionality will be built next.
    </v-alert>
  </v-container>
</template>

<script setup lang="ts">
</script>
`)
}

console.log('Generated tool apps:', apps.map(a => a.slug).join(', '))