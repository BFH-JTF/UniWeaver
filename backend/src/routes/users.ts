import { Router, Response } from 'express'
import { getAllUsers, getUserById, searchUsers, updateUser, LastAdminError, UpdateUserData } from '../db/users'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { requireAdmin, requireAuth } from '../auth/middleware'

export const usersRouter = Router()

// Relaxed to requireAuth so object-level administrators can look up
// collaborators for the Access dialog; only minimal fields are returned.
usersRouter.get('/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = String(req.query.q || '')
    if (!q || q.length < 1) {
      res.json([])
      return
    }
    const users = await searchUsers(getPool(), q)
    res.json(users
      .filter(u => u.is_active !== false)
      .map(u => ({
        id: u.id,
        name: u.display_name || u.name || u.id,
        email: u.email,
        is_admin: u.is_admin,
        is_active: u.is_active,
      })))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to search users' })
  }
})

usersRouter.get('/', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(await getAllUsers(getPool()))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch users' })
  }
})

usersRouter.get('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await getUserById(getPool(), String(req.params.id))
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(user)
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user' })
  }
})

usersRouter.patch('/:id', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {}
    const updates: UpdateUserData = {}

    if (body.name !== undefined) {
      const trimmedName = String(body.name).trim()
      if (!trimmedName) {
        res.status(400).json({ error: 'Username cannot be empty' })
        return
      }
      updates.name = trimmedName
    }
    if (body.email !== undefined) updates.email = String(body.email)
    if (body.local_name !== undefined) updates.local_name = String(body.local_name)
    if (body.display_name !== undefined) updates.display_name = String(body.display_name)
    if (body.is_active !== undefined) updates.is_active = !!body.is_active
    if (body.timezone !== undefined) updates.timezone = String(body.timezone)
    if (body.is_admin !== undefined) updates.is_admin = !!body.is_admin
    if (body.roles !== undefined && Array.isArray(body.roles)) updates.roles = body.roles

    const updated = await updateUser(getPool(), String(req.params.id), updates)
    if (!updated) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(updated)
  } catch (error: any) {
    if (error instanceof LastAdminError) {
      res.status(409).json({ error: error.message })
      return
    }
    res.status(500).json({ error: error.message || 'Failed to update user' })
  }
})