import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AuthConfig } from '@uniweaver/shared'

export interface VerifiedOidcClaims {
  iss: string
  sub: string
  name?: string
  email?: string
  preferred_username?: string
  [key: string]: unknown
}

const DISCOVERY_TIMEOUT_MS = 5000

function getPublicIssuer(): string {
  // Canonical issuer as advertised by the provider and used for the ID
  // token's iss claim check. With the same-origin OIDC proxy this is
  // "<backend origin>/oidc" (e.g. http://localhost:3000/oidc); set
  // OIDC_ISSUER explicitly for deployments that expose the provider directly.
  return (process.env.OIDC_ISSUER || '').replace(/\/+$/, '')
}

function getInternalIssuer(): string {
  // OIDC provider URL reachable from the backend container (docker-internal).
  // Falls back to the public issuer when backend and browser share it.
  return (process.env.OIDC_INTERNAL_ISSUER || process.env.OIDC_ISSUER || '').replace(/\/+$/, '')
}

interface DiscoveryDocument {
  authorization_endpoint?: string
  jwks_uri?: string
}

let cachedDiscovery: { issuer: string; document: DiscoveryDocument } | null = null

async function fetchDiscovery(): Promise<DiscoveryDocument | null> {
  const internalIssuer = getInternalIssuer()
  if (!internalIssuer) return null
  if (cachedDiscovery && cachedDiscovery.issuer === internalIssuer) {
    return cachedDiscovery.document
  }
  try {
    const res = await fetch(`${internalIssuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
    })
    if (res.ok) {
      const document = await res.json() as DiscoveryDocument
      cachedDiscovery = { issuer: internalIssuer, document }
      return document
    }
  } catch {
    // discovery is optional; callers fall back to constructed URLs
  }
  return null
}

/**
 * Rebase an advertised endpoint onto the internal issuer's origin. Providers
 * like docPouch advertise host-local absolute URLs built from the request's
 * Host header; those hosts are often not reachable from inside the docker
 * network, while the path is stable.
 */
function rebaseEndpoint(advertised: string, internalIssuer: string): string {
  try {
    const advertisedUrl = new URL(advertised)
    const internalUrl = new URL(internalIssuer)
    return `${internalUrl.origin}${advertisedUrl.pathname}`
  } catch {
    return advertised
  }
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const issuer = getPublicIssuer()
  const clientId = process.env.OIDC_CLIENT_ID || ''
  if (!issuer) {
    throw new Error('OIDC_ISSUER is not configured on the server')
  }
  let authorizationEndpoint: string | undefined
  const discovery = await fetchDiscovery()
  if (discovery?.authorization_endpoint) {
    // Only expose the authorization endpoint to the browser when it lives
    // under the public issuer; docker-internal URLs are never published.
    const endpoint = discovery.authorization_endpoint
    if (endpoint.startsWith(`${issuer}/`)) {
      authorizationEndpoint = endpoint
    }
  }
  return {
    issuer,
    clientId,
    providerName: process.env.OIDC_PROVIDER_NAME || 'OIDC',
    authorizationEndpoint,
  }
}

let remoteJwkSet: ReturnType<typeof createRemoteJWKSet> | null = null
let cachedJwksUrl = ''

async function getJwkSet(): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const internalIssuer = getInternalIssuer()
  const discovery = await fetchDiscovery()
  // Prefer the jwks_uri from discovery (rebased to the internal origin) —
  // providers are not required to expose /.well-known/jwks.json (docPouch
  // serves its keys at <issuer>/jwks instead).
  const jwksUrl = discovery?.jwks_uri
    ? rebaseEndpoint(discovery.jwks_uri, internalIssuer)
    : `${internalIssuer}/.well-known/jwks.json`
  if (!remoteJwkSet || cachedJwksUrl !== jwksUrl) {
    if (cachedJwksUrl && cachedJwksUrl !== jwksUrl) {
      console.warn(`[Auth] JWKS URL changed: ${cachedJwksUrl} -> ${jwksUrl}`)
    }
    remoteJwkSet = createRemoteJWKSet(new URL(jwksUrl), {
      cooldownDuration: 30000,
    })
    cachedJwksUrl = jwksUrl
  }
  return remoteJwkSet
}

export type ClientProbeResult = 'valid' | 'invalid' | 'unknown'

const PROBE_TIMEOUT_MS = 5000
// Dummy but spec-compliant S256 challenge (never completed, only probes client validity)
const PROBE_CODE_CHALLENGE = 'uniweaver-probe-code-challenge-0123456789abcdef0123456789'

async function getInternalAuthorizeEndpoint(): Promise<string | undefined> {
  const internalIssuer = getInternalIssuer()
  if (!internalIssuer) return undefined
  const discovery = await fetchDiscovery()
  if (discovery?.authorization_endpoint) {
    return rebaseEndpoint(discovery.authorization_endpoint, internalIssuer)
  }
  return `${internalIssuer}/auth`
}

/**
 * Probes whether a client id is registered at the provider for a given
 * redirect URI by issuing a non-redrawing authorization request.
 */
export async function probeClient(clientId: string, redirectUri: string): Promise<ClientProbeResult> {
  const authorizeEndpoint = await getInternalAuthorizeEndpoint()
  if (!authorizeEndpoint) return 'unknown'
  try {
    const url = `${authorizeEndpoint}?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid',
      state: 'uniweaver-probe',
      code_challenge: PROBE_CODE_CHALLENGE,
      code_challenge_method: 'S256',
    })}`
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    const location = res.headers.get('location') || ''
    if (location.includes('error=invalid_client')) {
      return 'invalid'
    }
    if (res.status >= 400) {
      // invalid_client etc. — the provider rejected the request outright
      return 'invalid'
    }
    // 2xx/3xx: the provider accepted the client and redirect
    return 'valid'
  } catch {
    return 'unknown'
  }
}

export async function verifyIdToken(idToken: string): Promise<VerifiedOidcClaims> {
  const issuer = getPublicIssuer()
  // The optional clientId pins the aud claim. With dynamic client
  // registration the SPA's client id is minted per deployment, so leave
  // OIDC_CLIENT_ID empty to accept any aud issued by this provider
  // (signature, iss and exp remain enforced).
  const clientId = process.env.OIDC_CLIENT_ID || ''
  if (!issuer) {
    throw new Error('Server OIDC configuration missing')
  }

  const jwtPayload = await jwtVerify(idToken, await getJwkSet(), {
    issuer,
    audience: clientId || undefined,
    clockTolerance: 5,
  })

  const payload = jwtPayload.payload
  const claims: VerifiedOidcClaims = {
    ...payload,
    iss: String(payload.iss),
    sub: String(payload.sub),
    name: typeof payload.name === 'string' ? payload.name : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    preferred_username: typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined,
  }

  if (!claims.iss || !claims.sub) {
    throw new Error('ID token is missing iss/sub claims')
  }
  return claims
}