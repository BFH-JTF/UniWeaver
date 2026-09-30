import { IronSession, getIronSession } from 'iron-session'
import type { Request, Response } from 'express'
import type { LocalUserProfile } from '@uniweaver/shared'

export interface SessionData {
  user?: LocalUserProfile
  issuer?: string
  subject?: string
  pendingBootstrap?: boolean
}

export function getSessionOptions() {
  const secret = process.env.SESSION_SECRET || ''
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters')
  }
  // Cookie is always host-scoped; all four apps are served from the same origin
  return {
    cookieName: 'uniweaver_session',
    password: secret,
    ttl: 7 * 24 * 60 * 60,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60,
    },
  }
}

export type AppIronSession = IronSession<SessionData>

export async function getSession(req: Request, res: Response): Promise<AppIronSession> {
  return getIronSession<SessionData>(req, res, getSessionOptions())
}

export async function requireSession(req: Request, res: Response): Promise<AppIronSession | null> {
  const session = await getSession(req, res)
  if (!session.user) {
    return null
  }
  return session
}