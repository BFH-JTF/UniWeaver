import type { Request, Response, NextFunction } from 'express'
import type { LocalUserProfile } from '@uniweaver/shared'
import { getSession } from './session'

export interface AuthenticatedRequest extends Request {
  sessionUser?: LocalUserProfile
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const session = await getSession(req, res)
  if (!session.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  req.sessionUser = session.user
  next()
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const session = await getSession(req, res)
  if (!session.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  if (!session.user.is_admin) {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  req.sessionUser = session.user
  next()
}