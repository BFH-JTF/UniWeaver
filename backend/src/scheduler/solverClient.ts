/**
 * Thin HTTP client for the UniWeaver scheduling service (scheduler/, port
 * 8081). Mirrors scheduler/typescript/scheduling-api.ts. The backend only
 * orchestrates: it POSTs the problem and polls until the solver stops.
 */

export interface SolverRoom {
  id: string
  name: string
  roomType: string
  capacity: number
  availability: Array<{
    weekId: string
    dayOfWeek: string
    startTime: string
    endTime: string
  }>
}

export interface SolverLecturer {
  id: string
  name: string
  availability: Array<{
    weekId: string
    dayOfWeek: string
    startTime: string
    endTime: string
  }>
}

export interface SolverTimeSlot {
  id: string
  weekId: string
  dayOfWeek: string
  startTime: string
  endTime: string
}

export interface SolverSession {
  id: string
  moduleId: string
  moduleName?: string
  classId: string
  className?: string
  studentCount: number
  durationMinutes: number
  sequenceIndex: number
  lecturerCandidateIds: string[]
}

export interface SolverRule {
  id: string
  ruleType: string
  category?: string
  weight: number
  enabled: boolean
  params?: Record<string, unknown>
  appliesTo?: string[]
}

export interface SolverRequest {
  semesterId: string
  rooms: SolverRoom[]
  lecturers: SolverLecturer[]
  timeSlots: SolverTimeSlot[]
  sessions: SolverSession[]
  schedulingRules?: SolverRule[]
  terminationSpentLimitSeconds?: number
}

export interface SolverSessionResult {
  id: string
  moduleId: string
  moduleName?: string
  classId: string
  className?: string
  assigned: boolean
  timeSlotId?: string
  weekId?: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  roomId?: string
  roomName?: string
  lecturerId?: string
  lecturerName?: string
}

export interface SolverResponse {
  jobId: string
  semesterId: string
  solverStatus: string
  score: { hardScore: number; softScore: number; feasible: boolean }
  sessions: SolverSessionResult[]
}

export function getSchedulerUrl(): string {
  return (process.env.SCHEDULER_URL || 'http://localhost:8081').replace(/\/+$/, '')
}

async function solverFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 10_000, ...initRest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(`${getSchedulerUrl()}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...initRest,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** True when the scheduling service answers its root probe. */
export async function schedulerHealth(timeoutMs = 2000): Promise<boolean> {
  try {
    const res = await solverFetch('/', { timeoutMs })
    return res.ok || res.status === 404 || res.status === 405
  } catch {
    return false
  }
}

/** Submit a solve job. Resolves with the jobId as soon as the service accepted it. */
export async function solverSubmit(request: SolverRequest): Promise<string> {
  const res = await solverFetch('/api/schedules', {
    method: 'POST',
    body: JSON.stringify(request),
    timeoutMs: 15_000,
  })
  if (!res.ok) {
    throw new Error(`Scheduling service rejected the solve request (HTTP ${res.status})`)
  }
  const data = (await res.json()) as { jobId?: string }
  if (!data.jobId) {
    throw new Error('Scheduling service did not return a job id')
  }
  return data.jobId
}

/** Fetch the current best solution for a job. */
export async function solverGet(jobId: string): Promise<SolverResponse> {
  const res = await solverFetch(`/api/schedules/${encodeURIComponent(jobId)}`, { timeoutMs: 10_000 })
  if (!res.ok) {
    throw new Error(`Failed to fetch solve status (HTTP ${res.status})`)
  }
  return (await res.json()) as SolverResponse
}

/** Poll until the solver stopped (solverStatus NOT_SOLVING) or the wait timeout hits. */
export async function solverSolveAndWait(
  request: SolverRequest,
  options: { pollMs?: number; waitTimeoutMs?: number } = {},
): Promise<SolverResponse> {
  const jobId = await solverSubmit(request)
  const pollMs = options.pollMs ?? 1000
  // Solver runtime is user-controlled; give the poller generous headroom.
  const waitTimeoutMs = options.waitTimeoutMs ?? (request.terminationSpentLimitSeconds ?? 30) * 1000 + 45_000
  const deadline = Date.now() + waitTimeoutMs
  let last: SolverResponse | null = null
  while (Date.now() < deadline) {
    last = await solverGet(jobId)
    if (last.solverStatus === 'NOT_SOLVING') {
      return last
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return last ?? (await solverGet(jobId))
}