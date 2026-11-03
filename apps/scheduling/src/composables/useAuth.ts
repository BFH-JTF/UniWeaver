import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { createToolAuth } from '@uniweaver/shared'
import { userEntryUrl } from '../config'

/** Auth guard delegating the shared logic in @uniweaver/shared. */
export function useAuth() {
  return createToolAuth({
    useAuthStore,
    useRouter,
    userEntryUrl,
  })
}
