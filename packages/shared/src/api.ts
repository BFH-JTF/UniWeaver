import type {
  AuthConfig,
  BootstrapStatus,
  HealthStatus,
  LocalUserProfile,
  MappingData,
  MappingPairPatch,
  MappingPairsResult,
} from './index'

export class ApiRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getApiBaseUrl(): string {
  return import.meta.env.DATABASE_URL?.replace(/\/+$/, '') || '/api'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`
    try {
      const data: unknown = await res.json()
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
        message = (data as { error: string }).error
      }
    } catch {
      // response had no JSON body
    }
    throw new ApiRequestError(res.status, message)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => request<HealthStatus>('/health'),

  getAuthConfig: () => request<AuthConfig>('/auth/config'),

  probeClient: (clientId: string, redirectUri: string) =>
    request<{ clientId: string; result: 'valid' | 'invalid' | 'unknown' }>(
      `/auth/probe-client?clientId=${encodeURIComponent(clientId)}&redirectUri=${encodeURIComponent(redirectUri)}`,
    ),

  createSession: (idToken: string) =>
    request<{ bootstrapRequired: boolean; user: LocalUserProfile }>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  me: () =>
    request<{ user: LocalUserProfile | null; bootstrapRequired?: boolean }>('/auth/me', { method: 'POST' }),

  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  bootstrapStatus: () => request<BootstrapStatus>('/auth/bootstrap-status'),

  bootstrapAdmin: (bootstrapSecret: string) =>
    request<{ bootstrapRequired: boolean; user: LocalUserProfile }>('/auth/bootstrap-admin', {
      method: 'POST',
      body: JSON.stringify({ bootstrapSecret }),
    }),

  listUsers: () => request<LocalUserProfile[]>('/users'),

  updateUser: (id: string, patch: Partial<LocalUserProfile>) =>
    request<LocalUserProfile>(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  /** Self-service: update the caller's own profile (e.g. lecturer opt-out). */
  updateMyProfile: (patch: Partial<LocalUserProfile>) =>
    request<LocalUserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  getMapping: () => request<MappingData>('/scheduling/mapping'),

  setMappingPairs: (pairs: MappingPairPatch[]) =>
    request<MappingPairsResult>('/scheduling/mapping/pairs', {
      method: 'POST',
      body: JSON.stringify({ pairs }),
    }),
}