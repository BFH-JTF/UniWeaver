import type { Department, Program, Degree, Module } from '@/types/curriculum'
import type { Room, RoomType } from '@/types/room'

/**
 * Curriculum entities carry several historical spellings of the same field
 * (`url`/`URL`, `departmentIDs`/`departmentIds`, ...). Records are written to the
 * JSONB store with every alias in sync, so readers can pick whichever they expect.
 * `url` and the capitalised relation keys (`ProgramIDs`, `DegreeIDs`) are authoritative.
 */
function syncUrl<T extends { url?: string; URL?: string }>(entity: T): T {
  const url = entity.url ?? ''
  return { ...entity, url, URL: url }
}

export function normalizeDepartment(department: Department): Department {
  return syncUrl({ ...department })
}

export function normalizeProgram(program: Program): Program {
  const departmentIDs = program.departmentIDs ?? program.departmentIds ?? []
  return syncUrl({ ...program, departmentIDs, departmentIds: departmentIDs })
}

export function normalizeDegree(degree: Degree): Degree {
  const programIDs = degree.ProgramIDs ?? degree.programIDs ?? degree.programIds ?? []
  return syncUrl({ ...degree, ProgramIDs: programIDs, programIDs, programIds: programIDs })
}

export function normalizeModule(mod: Module): Module {
  const degreeIDs = mod.DegreeIDs ?? mod.degreeIDs ?? mod.degreeIds ?? []
  return syncUrl({ ...mod, DegreeIDs: degreeIDs, degreeIDs, degreeIds: degreeIDs })
}

/**
 * Rooms were previously stored with snake_case top-level keys and a capacity
 * object; the ERD now defines camelCase keys and a flat numeric capacity.
 * Legacy snake_case rows are migrated on read; camelCase keys win.
 */
export function normalizeRoom(room: any): Room {
  const r = { ...room }
  const roomType = (r.roomType ?? r.room_type ?? 'other') as RoomType
  const locationId = r.locationId ?? r.location_id
  const roomNumber = r.roomNumber ?? r.room_number ?? ''
  let capacity = r.capacity
  if (typeof capacity === 'object' && capacity !== null) {
    capacity = Number((capacity as any).seats) || 0
  }
  capacity = Number(capacity) || 0
  delete r.room_type
  delete r.location_id
  delete r.room_number
  if ('availability' in r) delete r.availability
  return { ...r, roomType, locationId, roomNumber, capacity } as Room
}
