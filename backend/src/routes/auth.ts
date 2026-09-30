import { Router, Request, Response } from 'express'
import { fetchAuthConfig, verifyIdToken, probeClient } from '../auth/verify'
import { getSession, type AppIronSession } from '../auth/session'
import {
  timingSafeEqualString,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
} from '../auth/bootstrap'
import {
  getAdminCount,
  createOrUpdateUser,
  bootstrapAdminUser,
} from '../db/users'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { requireAuth } from '../auth/middleware'

export const authRouter = Router()

authRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchAuthConfig())
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load auth configuration' })
  }
})

/**
 * GET /api/auth/probe-client?clientId=...&redirectUri=...
 * Allows the SPA to check whether a candidate client id is registered at the
 * provider without exposing provider internals to the browser.
 */
authRouter.get('/probe-client', async (req: Request, res: Response) => {
  try {
    const clientId = String(req.query.clientId || '')
    const redirectUri = String(req.query.redirectUri || '')
    if (!clientId || !redirectUri) {
      res.status(400).json({ error: 'clientId and redirectUri are required' })
      return
    }
    const result = await probeClient(clientId, redirectUri)
    res.json({ clientId, result })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Client probe failed' })
  }
})

authRouter.get('/bootstrap-status', async (_req: Request, res: Response) => {
  try {
    const adminCount = await getAdminCount(getPool())
    res.json({ bootstrapRequired: adminCount === 0, adminCount })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check bootstrap status' })
  }
})

/**
 * POST /api/auth/session
 * Exchanges a verified ID token for a server-side session cookie. The login
 * always completes on its own: when no administrator exists yet the user is
 * signed in as a regular user and `bootstrapRequired` tells the SPA that it
 * may offer the elevation prompt afterwards.
 */
authRouter.post('/session', async (req: Request, res: Response) => {
  try {
    const idToken = req.body?.idToken
    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({ error: 'idToken is required' })
      return
    }

    let claims
    try {
      claims = await verifyIdToken(String(idToken))
    } catch (err: any) {
      res.status(401).json({ error: `Invalid ID token: ${err.message}` })
      return
    }

    const adminCount = await getAdminCount(getPool())
    const session = await getSession(req, res)

    const user = await createOrUpdateUser(getPool(), {
      oidc_issuer: claims.iss,
      oidc_subject: claims.sub,
      name: claims.name || claims.preferred_username || claims.sub,
      email: claims.email || '',
    })

    if (!user.is_active) {
      res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' })
      return
    }

    const bootstrapRequired = adminCount === 0 && !user.is_admin

    session.pendingBootstrap = bootstrapRequired
    session.user = user
    session.issuer = claims.iss
    session.subject = claims.sub
    await session.save()

    res.json({ bootstrapRequired, user })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to establish session' })
  }
})

/**
 * POST /api/auth/bootstrap-admin
 * Elevates the currently logged-in user to the first administrator using the
 * deployment bootstrap secret. A fully established session is required.
 */
authRouter.post('/bootstrap-admin', async (req: Request, res: Response) => {
  try {
    const session = await getSession(req, res)
    const sessionUser = session.user
    const issuer = session.issuer || sessionUser?.oidc_issuer
    const subject = session.subject || sessionUser?.oidc_subject

    if (!sessionUser || !issuer || !subject) {
      res.status(401).json({ error: 'You must be logged in before bootstrapping the first administrator' })
      return
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown_ip'
    const rateLimitIdentifier = `${clientIp}_${issuer}_${subject}`
    const rateCheck = checkRateLimit(rateLimitIdentifier)
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: 'Too many failed bootstrap attempts. Please try again later.',
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      })
      return
    }

    const configuredSecret = process.env.BOOTSTRAP_ADMIN_SECRET
    if (!configuredSecret) {
      res.status(500).json({ error: 'Server configuration error: BOOTSTRAP_ADMIN_SECRET is not configured' })
      return
    }

    const suppliedSecret = req.body?.bootstrapSecret
    if (
      !suppliedSecret ||
      typeof suppliedSecret !== 'string' ||
      !timingSafeEqualString(suppliedSecret, configuredSecret)
    ) {
      recordFailedAttempt(rateLimitIdentifier)
      res.status(401).json({ error: 'Invalid bootstrap secret' })
      return
    }

    const result = await bootstrapAdminUser(getPool(), {
      oidc_issuer: issuer,
      oidc_subject: subject,
      name: sessionUser.name || sessionUser.display_name || undefined,
      email: sessionUser.email || undefined,
    })

    if (!result.success) {
      res.status(409).json({ error: result.error || 'Bootstrap failed' })
      return
    }

    resetRateLimit(rateLimitIdentifier)
    session.pendingBootstrap = false
    session.user = result.user!
    await session.save()

    res.status(201).json({ bootstrapRequired: false, user: result.user })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Bootstrap failed' })
  }
})

authRouter.post('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.sessionUser!
  try {
    const adminCount = await getAdminCount(getPool())
    res.json({ authenticated: true, user, bootstrapRequired: adminCount === 0 && !user.is_admin })
  } catch {
    res.json({ authenticated: true, user, bootstrapRequired: false })
  }
})

authRouter.post('/logout', async (req: Request, res: Response) => {
  const session: AppIronSession = await getSession(req, res)
  session.destroy()
  res.json({ success: true })
})