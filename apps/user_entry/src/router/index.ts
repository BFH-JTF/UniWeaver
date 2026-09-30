import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import('@/views/CallbackView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'portal',
      component: () => import('@/views/PortalView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'portal' },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const auth = useAuthStore()
  const ok = await auth.initAuth()
  if (!ok) {
    return { name: 'login' }
  }
  return true
})

export default router