import { createRouter, createWebHistory } from 'vue-router'
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
      path: '/mapping',
      name: 'mapping',
      component: () => import('@/views/MappingView.vue'),
    },
    {
      path: '/rooms',
      name: 'rooms',
      component: () => import('@/views/RoomsView.vue'),
    },
    {
      path: '/availability',
      name: 'availability',
      component: () => import('@/views/AvailabilityView.vue'),
    },
    {
      path: '/schedules',
      name: 'schedules',
      component: () => import('@/views/SchedulesView.vue'),
    },
    {
      path: '/schedules/:runId',
      name: 'schedule-detail',
      component: () => import('@/views/SchedulesView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const { ensureAuth } = useAuth()

  const ok = await ensureAuth()
  if (!ok) return false
  return true
})

export default router
