import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

const appsRoot = path.resolve(import.meta.dirname, '..', 'apps')

for (const app of ['administration', 'scheduling', 'competencies']) {
  const routerPath = path.join(appsRoot, app, 'src/router/index.ts')
  const router = `import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'

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

  const auth = useAuthStore()
  const { ensureAuth } = useAuth()

  const ok = await ensureAuth()
  if (!ok) return false
  return true
})

export default router
`
  writeFileSync(routerPath, router)

  const appVuePath = path.join(appsRoot, app, 'src/App.vue')
  let appVue = readFileSync(appVuePath, 'utf8')
  appVue = appVue.replace(
    `import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'

const drawer = ref(false)
const auth = useAuthStore()
const { logout } = useAuth()`,
    `import { useAuthStore } from '@/stores/auth'
import { useAuth } from '@/composables/useAuth'

const drawer = ref(false)
const auth = useAuthStore()
useAuth()`
  )
  writeFileSync(appVuePath, appVue)
}

console.log('Fixed tool app routers and App.vue')