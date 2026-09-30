import { ref } from 'vue'
import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { api } from '@uniweaver/shared'

const CLIENT_ID_STORAGE_KEY = 'uniweaver_oidc_client_id'

export class ProviderUnreachableError extends Error {
  constructor(issuer: string) {
    super(`The login provider at ${issuer} is not reachable. Please try again later or contact your administrator.`)
    this.name = 'ProviderUnreachableError'
  }
}

export const useOidc = () => {
  const error = ref('')
  const isLoading = ref(false)

  let userManager: UserManager | null = null

  // The user_entry SPA is mounted at base '/user_entry/' (dev and production),
  // so all of its routes live under that prefix.
  function getCallbackUrl(): string {
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/+$/, '')}/callback`
  }

  function getPostLogoutUrl(): string {
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/+$/, '')}/login`
  }

  function getStoredClientId(): string {
    return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || ''
  }

  /**
   * Resolves a client id that is actually usable at the provider. Order:
   *   1. previously self-registered client (localStorage)
   *   2. env-configured client id — validated via backend probe
   *   3. fresh dynamic registration (RFC 7591)
   * Falls back to the env value when probing/registration is not possible,
   * so misconfigurations surface as provider errors instead of silent drift.
   */
  async function resolveClientId(issuer: string, envClientId: string): Promise<string> {
    // 1. Previously persisted, dynamically registered client
    const stored = getStoredClientId()
    if (stored) {
      const probe = await api.probeClient(stored, getCallbackUrl())
      if (probe.result !== 'invalid') return stored
      localStorage.removeItem(CLIENT_ID_STORAGE_KEY)
    }

    // 2. Env-configured client — only usable if actually registered
    if (envClientId) {
      const probe = await api.probeClient(envClientId, getCallbackUrl())
      if (probe.result === 'valid') return envClientId
    }

    // 3. Dynamic client registration
    const registered = await selfRegister(issuer)
    if (registered) return registered

    return envClientId || stored
  }

  async function fetchRegistrationEndpoint(issuer: string): Promise<string> {
    const res = await fetch(`${issuer}/.well-known/openid-configuration`)
    if (!res.ok) {
      throw new ProviderUnreachableError(issuer)
    }
    const discovery = await res.json() as { registration_endpoint?: string }
    if (!discovery.registration_endpoint) {
      throw new Error('Provider does not support dynamic client registration')
    }
    return discovery.registration_endpoint
  }

  async function selfRegister(issuer: string): Promise<string | null> {
    try {
      const registrationEndpoint = await fetchRegistrationEndpoint(issuer)
      const res = await fetch(registrationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'UniWeaver',
          application_type: 'web',
          redirect_uris: [getCallbackUrl()],
          post_logout_redirect_uris: [getPostLogoutUrl()],
          grant_types: ['authorization_code'],
          response_types: ['code'],
          scope: 'openid profile email',
          token_endpoint_auth_method: 'none',
        }),
      })
      if (!res.ok) return null
      const data = await res.json() as { client_id?: string }
      if (data.client_id) {
        localStorage.setItem(CLIENT_ID_STORAGE_KEY, data.client_id)
        return data.client_id
      }
      return null
    } catch (err) {
      if (err instanceof ProviderUnreachableError) throw err
      console.warn('Dynamic client registration failed:', err)
      return null
    }
  }

  async function getUserManager(): Promise<UserManager | null> {
    if (userManager) return userManager
    isLoading.value = true
    try {
      const config = await api.getAuthConfig()
      // Fail fast with a clear message when the provider is unreachable —
      // otherwise the user would be redirected to a dead URL.
      await assertProviderReachable(config.issuer)
      const clientId = await resolveClientId(config.issuer, config.clientId)
      userManager = new UserManager({
        authority: config.issuer,
        client_id: clientId,
        redirect_uri: getCallbackUrl(),
        post_logout_redirect_uri: getPostLogoutUrl(),
        scope: 'openid profile email',
        response_type: 'code',
        userStore: new WebStorageStateStore({ store: window.localStorage }),
        automaticSilentRenew: true,
        loadUserInfo: false,
      })
      return userManager
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load OIDC configuration'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function assertProviderReachable(issuer: string): Promise<void> {
    try {
      const res = await fetch(`${issuer}/.well-known/openid-configuration`)
      if (!res.ok) throw new ProviderUnreachableError(issuer)
    } catch (err) {
      if (err instanceof ProviderUnreachableError) throw err
      throw new ProviderUnreachableError(issuer)
    }
  }

  async function login(): Promise<void> {
    error.value = ''
    const um = await getUserManager()
    if (!um) {
      // getUserManager already set a specific error message (e.g. provider
      // unreachable); the login view displays it.
      return
    }
    // Always require fresh credentials at the provider: with prompt=login the
    // provider's SSO session is ignored, so a previously signed-in user must
    // re-enter their credentials on every login.
    await um.signinRedirect({ prompt: 'login' })
  }

  async function logout(): Promise<void> {
    const um = await getUserManager()
    if (!um) return
    // RP-initiated logout: also destroys the provider's SSO session, so the
    // next login requires credentials again. The provider redirects back to
    // its post_logout_redirect_uri afterwards. If the provider is unreachable,
    // fall back to a local-only teardown so the user is still signed out of
    // UniWeaver.
    const idToken = (await um.getUser())?.id_token
    try {
      await um.signoutRedirect({ id_token_hint: idToken })
    } catch (err) {
      console.warn('Provider signout failed, clearing local state only:', err)
      await um.removeUser()
    }
  }

  async function handleCallback(): Promise<string | null> {
    const um = await getUserManager()
    if (!um) return null
    try {
      const user = await um.signinCallback()
      const typed = user as User | undefined
      return typed?.id_token ?? null
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'OIDC callback failed'
      return null
    }
  }

  return { error, isLoading, login, logout, handleCallback, getUserManager }
}