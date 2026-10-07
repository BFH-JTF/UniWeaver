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