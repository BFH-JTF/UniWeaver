export const TOOL_ROUTES = ['administration', 'scheduling', 'competencies'] as const

export type ToolRoute = (typeof TOOL_ROUTES)[number]

export { api, ApiRequestError, getApiBaseUrl } from './api'
export * from './restrictions'
export * from './restrictionSolver'

export interface ToolLink {
  key: ToolRoute
  title: string
  description: string
  icon: string
  url: string
}

export interface LocalUserProfile {
  id: string
  oidc_issuer: string
  oidc_subject: string
  name: string
  email: string
  local_name?: string
  display_name?: string
  is_active?: boolean
  timezone?: string
  roles: string[]
  is_admin: boolean
  is_user_admin?: boolean
  is_scheduler?: boolean
  /** Opt-out: exclude this account from lecturer lists (self-service or admin-set). */
  is_not_lecturer?: boolean
  created_at?: string
  updated_at?: string
}

export interface MappingLecturer {
  id: string
  name: string
  departmentId: string
  departmentName: string
  /** Display name of the linked login account, if any. */
  displayLabel: string
  contact: string
  /** True when this lecturer row is backed by (auto-provisioned from) a user account. */
  isAccountBased: boolean
}

export interface MappingDepartment {
  id: string
  name: string
  programIds: string[]
}

export interface MappingProgram {
  id: string
  name: string
  departmentIds: string[]
  curriculumId: string
}

export interface MappingDegree {
  id: string
  name: string
  programIds: string[]
}

export interface MappingModule {
  id: string
  code: string
  name: string
  degreeIds: string[]
  curriculumVersionId: string
}

export interface MappingCurriculumVersion {
  id: string
  name: string
  programId: string
}

export interface MappingPair {
  lecturerId: string
  moduleId: string
}

export interface MappingPairPatch {
  lecturerId: string
  moduleId: string
  value: 0 | 1
}

export interface MappingData {
  lecturers: MappingLecturer[]
  departments: MappingDepartment[]
  programs: MappingProgram[]
  degrees: MappingDegree[]
  modules: MappingModule[]
  curriculumVersions: MappingCurriculumVersion[]
  pairs: MappingPair[]
}

export interface MappingPairsResult {
  applied: Array<MappingPairPatch>
}

// ------------------------------------------------------------------ Rooms

export type RoomType = 'lecture_hall' | 'classroom' | 'computer_lab' | 'laboratory' | 'other'

export type LayoutType = 'rows' | 'u_shape' | 'boardroom' | 'laboratory_benches' | 'computer_workstations' | 'other'

export type ConnectionType = 'HDMI' | 'DisplayPort' | 'USB-C' | 'VGA' | '3.5mm_audio' | 'Ethernet'

export type StreamingCameraType = 'fixed' | 'tracking' | 'pan_tilt_zoom'

export type StreamingCameraQuality = '720p' | '1080p' | '4k'

export interface RoomLayout {
  type?: LayoutType
  movable_desks?: boolean
  movable_chairs?: boolean
  group_work_possible?: boolean
  floor_area_m2?: number
}

export interface StreamingCamera {
  available: boolean
  type?: StreamingCameraType
  position?: string
  quality?: StreamingCameraQuality
}

export interface VideoConferencing {
  available: boolean
  system?: string
  supports_remote_participants?: boolean
}

export interface RoomEquipment {
  whiteboards?: number
  blackboard?: boolean
  flipchart?: boolean
  smartboard?: boolean
  projector?: boolean
  projector_count?: number
  display_type?: string | string[]
  document_camera?: boolean
  lectern?: boolean
  speakers?: boolean
  microphone?: boolean
  lecture_capture?: boolean
  streaming_camera?: StreamingCamera
  video_conferencing?: VideoConferencing
}

export interface RoomConnectivity {
  wifi?: boolean
  wired_network?: boolean
  network_speed_mbps?: number
  power_outlets?: number
  connections?: ConnectionType[]
  wireless_presentation?: boolean
}

export interface RoomAccessibility {
  step_free_access?: boolean
  accessible_door?: boolean
  accessible_seating?: boolean
  hearing_loop?: boolean
  braille_signage?: boolean
  accessible_restrooms_nearby?: boolean
}

export interface RoomMaintenance {
  last_updated?: string
}

/** Room as served by /api/scheduling/rooms. */
export interface SchedulerRoom {
  id: string
  name: string
  roomType: RoomType
  owner: string
  locationId?: string
  /** Denormalized read-only labels from the linked location. */
  locationName: string
  locationBuilding: string
  floor: number | string
  roomNumber: string
  capacity: number
  layout?: RoomLayout
  equipment?: RoomEquipment
  connectivity?: RoomConnectivity
  accessibility?: RoomAccessibility
  maintenance?: RoomMaintenance
  /** Recurring availability slots (GET includes aggregated count). */
  availabilityCount: number
}

/** Location as served by /api/scheduling/locations. */
export interface SchedulerLocation {
  id: string
  name: string
  campus: string
  building: string
  address: string
  latitude?: number
  longitude?: number
}

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

/** Recurring weekly availability slot for a room (weekId null = every week). */
export interface RoomAvailabilitySlot {
  id: string
  roomId: string
  /** Semester week this slot applies to; null = applies to all weeks. */
  weekId: string | null
  weekday: Weekday
  /** HH:MM */
  startTime: string
  /** HH:MM */
  endTime: string
}

// ------------------------------------------------------------------ Lecturer availability

/**
 * Unavailability entry for a lecturer ("I am NOT available"). Inverted
 * semantics versus rooms: the semester's timeslots define the teachable
 * windows, lecturers mark exceptions.
 * - weekly_recurring: every week on weekday (times null = whole day)
 * - individual_date: one concrete date, optionally with a time window
 */
export type UnavailabilityKind = 'weekly_recurring' | 'individual_date'

export interface UnavailabilityEntry {
  id?: string
  kind: UnavailabilityKind
  weekday?: Weekday | null
  /** ISO date YYYY-MM-DD (individual_date only). */
  date?: string | null
  /** HH:MM or null = whole day. */
  startTime?: string | null
  /** HH:MM or null = whole day. */
  endTime?: string | null
  note?: string
}

/** Lecturer as served by /api/scheduling/lecturers. */
export interface SchedulingLecturer {
  id: string
  name: string
  departmentId: string
  departmentName: string
  contact: string
  /** Login account linked to this lecturer, if any. */
  accountId: string | null
  displayLabel: string
  isAccountBased: boolean
  unavailabilityCount: number
}

// ------------------------------------------------------------------ Schedule generation

/** Status of a generated schedule run. */
export type ScheduleRunStatus = 'pending' | 'generating' | 'draft' | 'published' | 'failed'

/** One solve of the Timefold scheduling service for one semester. */
export interface ScheduleRun {
  id: string
  semesterId: string
  semesterName: string
  name: string
  status: ScheduleRunStatus
  score: {
    hardScore?: number
    softScore?: number
    feasible?: boolean
  }
  stats: {
    sessionsTotal?: number
    sessionsPlaced?: number
    sessionsUnplaced?: number
    classes?: number
    modules?: number
    rooms?: number
    lecturers?: number
    /** Human-readable assembly/solver notes surfaced in the UI. */
    warnings?: string[]
    /** Per-session placement failures (modules the solver could not place). */
    unplaced?: Array<{
      sessionId: string
      moduleId: string
      moduleName?: string
      classId: string
      className?: string
    }>
    error?: string
  }
  meta: {
    spentLimitSeconds?: number
  }
  createdBy: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  entryCount: number
}

/** One placed calendar slot of a schedule run (recurring: weekId null).
 * Includes denormalized display names resolved by the backend. */
export interface ScheduleEntryRow {
  id: string
  runId: string
  weekId: string | null
  weekday: Weekday
  startTime: string
  endTime: string
  moduleIds: string[]
  roomIds: string[]
  classIds: string[]
  lecturerIds: string[]
  /** Display names resolved server-side (same order as the id arrays). */
  moduleNames: string[]
  roomNames: string[]
  classNames: string[]
  lecturerNames: string[]
}

/** Semester as offered in the schedule-generation wizard. */
export interface SchedulingSemester {
  id: string
  name: string
  code: string
  startDate: string | null
  endDate: string | null
  slotDurationMinutes: number | null
  slotStartTimes: string[]
  weekCount: number
  classCount: number
}

/** Live scope summary shown on wizard step 2 before generating. */
export interface ScheduleScopeSummary {
  semesterId: string
  sessions: number
  classes: number
  modules: number
  rooms: number
  lecturers: number
  /** Assembly warnings that will apply (e.g. modules without lecturer mapping). */
  warnings: string[]
  /** True when the semester lacks a usable timeslot grid. */
  gridMissing: boolean
}

export interface AuthConfig {
  issuer: string
  clientId: string
  providerName: string
  authorizationEndpoint?: string
}

export interface BootstrapStatus {
  bootstrapRequired: boolean
  adminCount: number
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  databaseConnected: boolean
  timestamp: string
}

export interface ApiError {
  error: string
}

export const DEFAULT_TOOL_LINKS: ToolLink[] = [
  {
    key: 'administration',
    title: 'Administration',
    description: 'Curriculum administration: programs, modules, lecturers, rooms and semesters.',
    icon: 'mdi-book-education',
    url: '/administration',
  },
  {
    key: 'scheduling',
    title: 'Scheduling',
    description: 'Generate and manage the semester schedule based on restrictions and constraints.',
    icon: 'mdi-calendar-clock',
    url: '/scheduling',
  },
  {
    key: 'competencies',
    title: 'Competencies',
    description: 'Create a competency mapping and competency scheduling.',
    icon: 'mdi-map-legend',
    url: '/competencies',
  },
]