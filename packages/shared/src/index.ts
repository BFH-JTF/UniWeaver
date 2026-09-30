export const TOOL_ROUTES = ['administration', 'scheduling', 'competencies'] as const

export type ToolRoute = (typeof TOOL_ROUTES)[number]

export { api, ApiRequestError, getApiBaseUrl } from './api'

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
  created_at?: string
  updated_at?: string
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