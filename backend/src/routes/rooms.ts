import { Router, Response } from 'express'
import { getPool } from '../db'
import type { AuthenticatedRequest } from '../auth/middleware'
import { requireScheduler } from '../auth/middleware'
import { getSession } from '../auth/session'
import { findEntityReferences, deleteEntityWithCleanup } from '../db/referenceChecks'
import type { ReferenceFinding } from '../db/referenceChecks'

export const roomsRouter = Router()

/**
 * Rooms, locations and room availability for the Scheduling tool.
 * Read: any authenticated user. Write: global admins or schedulers only
 * (requireScheduler on every mutating route). Rooms are shared resources, so
 * the per-entity ACL of the generic entity router does not apply here.
 */

roomsRouter.use(async (req, res, next) => {
  try {
    const session = await getSession(req, res)
    if (!session.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    ;(req as AuthenticatedRequest).sessionUser = session.user
    next()
  } catch (err) {
    next(err)
  }
})

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

// ------------------------------------------------------------------ locations
roomsRouter.get('/locations', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await getPool().query(
      `SELECT id, name, campus, building, address, latitude, longitude
       FROM locations ORDER BY name ASC`,
    )
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      name: r.name || '',
      campus: r.campus || '',
      building: r.building || '',
      address: r.address || '',
      latitude: r.latitude ?? undefined,
      longitude: r.longitude ?? undefined,
    })))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load locations' })
  }
})

roomsRouter.post('/locations', requireScheduler, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const body = _req.body || {}
    const name = String(body.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }
    const id = typeof body.id === 'string' && body.id ? body.id : genId('uw_loc')
    const result = await getPool().query(
      `INSERT INTO locations (id, name, campus, building, address, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, campus, building, address, latitude, longitude`,
      [
        id,
        name,
        String(body.campus ?? ''),
        String(body.building ?? '').trim(),
        String(body.address ?? ''),
        body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null,
        body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null,
      ],
    )
    res.status(201).json(result.rows[0])
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create location' })
  }
})

roomsRouter.put('/locations/:id', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {}
    const name = String(body.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }
    const result = await getPool().query(
      `UPDATE locations SET name = $2, campus = $3, building = $4, address = $5,
              latitude = $6, longitude = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, campus, building, address, latitude, longitude`,
      [
        req.params.id,
        name,
        String(body.campus ?? ''),
        String(body.building ?? '').trim(),
        String(body.address ?? ''),
        body.latitude != null && body.latitude !== '' ? Number(body.latitude) : null,
        body.longitude != null && body.longitude !== '' ? Number(body.longitude) : null,
      ],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
    res.json(result.rows[0])
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update location' })
  }
})

roomsRouter.get('/locations/:id/references', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const references = await findEntityReferences(getPool(), 'locations', String(req.params.id))
    res.json({ table: 'locations', id: req.params.id, references })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to inspect location references' })
  }
})

roomsRouter.get('/rooms/:id/references', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const references = await findEntityReferences(getPool(), 'rooms', String(req.params.id))
    res.json({ table: 'rooms', id: req.params.id, references })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to inspect room references' })
  }
})

roomsRouter.delete('/locations/:id', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool()
    const references = await findEntityReferences(pool, 'locations', String(req.params.id))
    const blocking = references.filter((r: ReferenceFinding) => r.severity !== 'cleanup')
    const confirmed = req.query.confirm === 'true' || req.query.confirm === '1'
    if (blocking.length > 0 && !confirmed) {
      res.status(409).json({
        error: 'Location is referenced elsewhere; pass ?confirm=true to delete it anyway',
        references,
      })
      return
    }
    const removed = await deleteEntityWithCleanup(pool, 'locations', String(req.params.id))
    if (!removed) {
      res.status(404).json({ error: 'Location not found' })
      return
    }
    res.json({ ok: true, references })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete location' })
  }
})

// ------------------------------------------------------------------ rooms
roomsRouter.get('/rooms', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await getPool().query(
      `SELECT r.*, l.name AS location_name, l.building AS location_building,
              (SELECT count(*)::int FROM room_availability ra WHERE ra.room_id = r.id) AS availability_count
       FROM rooms r
       LEFT JOIN locations l ON l.id = r.location_id
       ORDER BY r.name ASC`,
    )
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      name: r.name || '',
      roomType: r.room_type || 'other',
      owner: r.owner || '',
      locationId: r.location_id || undefined,
      locationName: r.location_name || '',
      locationBuilding: r.location_building || '',
      floor: r.floor ?? '',
      roomNumber: r.room_number || '',
      capacity: r.capacity ?? 0,
      layout: r.layout ?? undefined,
      equipment: r.equipment ?? undefined,
      connectivity: r.connectivity ?? undefined,
      accessibility: r.accessibility ?? undefined,
      maintenance: r.maintenance ?? undefined,
      availabilityCount: r.availability_count ?? 0,
    })))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load rooms' })
  }
})

roomsRouter.post('/rooms', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {}
    const name = String(body.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }
    const id = typeof body.id === 'string' && body.id ? body.id : genId('uw_room')
    const result = await getPool().query(
      `INSERT INTO rooms (id, name, room_type, owner, location_id, floor, room_number, capacity,
                          layout, equipment, connectivity, accessibility, maintenance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        id,
        name,
        String(body.roomType || 'other'),
        String(body.owner ?? ''),
        body.locationId || null,
        String(body.floor ?? ''),
        String(body.roomNumber ?? ''),
        body.capacity != null && body.capacity !== '' ? Number(body.capacity) : null,
        body.layout ? JSON.stringify(body.layout) : null,
        body.equipment ? JSON.stringify(body.equipment) : null,
        body.connectivity ? JSON.stringify(body.connectivity) : null,
        body.accessibility ? JSON.stringify(body.accessibility) : null,
        body.maintenance ? JSON.stringify(body.maintenance) : null,
      ],
    )
    res.status(201).json({ id: result.rows[0]!.id })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create room' })
  }
})

roomsRouter.put('/rooms/:id', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {}
    const name = String(body.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }
    const result = await getPool().query(
      `UPDATE rooms SET name = $2, room_type = $3, owner = $4, location_id = $5, floor = $6,
              room_number = $7, capacity = $8, layout = $9, equipment = $10, connectivity = $11,
              accessibility = $12, maintenance = $13, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [
        req.params.id,
        name,
        String(body.roomType || 'other'),
        String(body.owner ?? ''),
        body.locationId || null,
        String(body.floor ?? ''),
        String(body.roomNumber ?? ''),
        body.capacity != null && body.capacity !== '' ? Number(body.capacity) : null,
        body.layout ? JSON.stringify(body.layout) : null,
        body.equipment ? JSON.stringify(body.equipment) : null,
        body.connectivity ? JSON.stringify(body.connectivity) : null,
        body.accessibility ? JSON.stringify(body.accessibility) : null,
        body.maintenance ? JSON.stringify(body.maintenance) : null,
      ],
    )
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' })
      return
    }
    res.json({ ok: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update room' })
  }
})

roomsRouter.delete('/rooms/:id', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pool = getPool()
    const references = await findEntityReferences(pool, 'rooms', String(req.params.id))
    const blocking = references.filter((r: ReferenceFinding) => r.severity !== 'cleanup')
    const confirmed = req.query.confirm === 'true' || req.query.confirm === '1'
    if (blocking.length > 0 && !confirmed) {
      res.status(409).json({
        error: 'Room is referenced elsewhere; pass ?confirm=true to delete it anyway',
        references,
      })
      return
    }
    const removed = await deleteEntityWithCleanup(pool, 'rooms', String(req.params.id))
    if (!removed) {
      res.status(404).json({ error: 'Room not found' })
      return
    }
    res.json({ ok: true, references })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete room' })
  }
})

// ------------------------------------------------------------------ availability
interface AvailabilityInput {
  weekId?: string | null
  weekday: string
  startTime: string
  endTime: string
}

const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function validAvailability(list: unknown, res: Response): AvailabilityInput[] | null {
  if (!Array.isArray(list) || list.length === 0) return []
  const out: AvailabilityInput[] = []
  for (const raw of list) {
    const weekday = String(raw?.weekday || '').toLowerCase()
    const startTime = String(raw?.startTime || '')
    const endTime = String(raw?.endTime || '')
    if (!WEEKDAYS.has(weekday) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      res.status(400).json({ error: 'Availability needs weekday (monday..sunday) and HH:MM start/end times' })
      return null
    }
    if (endTime <= startTime) {
      res.status(400).json({ error: 'endTime must be after startTime' })
      return null
    }
    out.push({
      weekId: raw.weekId || null,
      weekday,
      startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
      endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
    })
  }
  return out
}

roomsRouter.get('/rooms/:id/availability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await getPool().query(
      `SELECT id, room_id, week_id, weekday,
              to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time, 'HH24:MI') AS end_time
       FROM room_availability
       WHERE room_id = $1
       ORDER BY week_id NULLS FIRST, weekday ASC, start_time ASC`,
      [req.params.id],
    )
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      roomId: r.room_id,
      weekId: r.week_id || null,
      weekday: r.weekday,
      startTime: r.start_time,
      endTime: r.end_time,
    })))
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load room availability' })
  }
})

/** Full replace of a room's availability slots (single transaction). */
roomsRouter.put('/rooms/:id/availability', requireScheduler, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const slots = validAvailability(req.body?.slots, res)
    if (!slots) return

    const pool = getPool()
    const exists = await pool.query('SELECT id FROM rooms WHERE id = $1', [req.params.id])
    if (exists.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' })
      return
    }

    for (const slot of slots) {
      if (slot.weekId) {
        const week = await pool.query('SELECT id FROM weeks WHERE id = $1', [slot.weekId])
        if (week.rows.length === 0) {
          res.status(400).json({ error: `Unknown week: ${slot.weekId}` })
          return
        }
      }
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM room_availability WHERE room_id = $1', [req.params.id])
      for (const slot of slots) {
        await client.query(
          `INSERT INTO room_availability (id, room_id, week_id, weekday, start_time, end_time, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [genId('uw_rav'), req.params.id, slot.weekId, slot.weekday, slot.startTime, slot.endTime, req.sessionUser!.id],
        )
      }
      await client.query('COMMIT')
      res.json({ ok: true, count: slots.length })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save room availability' })
  }
})