export interface AclInfo {
  _canEdit?: boolean
  _isAdmin?: boolean
}

export interface Department extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  contact?: string
  url?: string
  /** @deprecated Use url instead */
  URL?: string
}

export type DepartmentExport = Department[]

export interface Curriculum extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  activeVersionId?: string
  createdAt?: string
  updatedAt?: string
}

export interface CurriculumVersion extends AclInfo {
  _id?: string
  id?: string
  curriculumId?: string
  name: string
  description?: string
  versionNumber: number
  semesterId?: string
  createdBy?: string
  createdByName?: string
  createdAt?: string
}

export interface Program extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  departmentIds?: string[]
  /** @deprecated Use departmentIds instead */
  departmentIDs?: string[]
  curriculumId?: string
  contact?: string
  url?: string
  /** @deprecated Use url instead */
  URL?: string
}

export type ProgramExport = Program[]

export interface Degree extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  programIds?: string[]
  /** @deprecated Use programIds instead */
  ProgramIDs?: string[]
  /** @deprecated Use programIds instead */
  programIDs?: string[]
  contact?: string
  url?: string
  /** @deprecated Use url instead */
  URL?: string
}

export type DegreeExport = Degree[]

export interface Module extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  degreeIds?: string[]
  /** @deprecated Use degreeIds instead */
  DegreeIDs?: string[]
  /** @deprecated Use degreeIds instead */
  degreeIDs?: string[]
  contact?: string
  url?: string
  /** @deprecated Use url instead */
  URL?: string
  code?: string
  creditPoints?: number
  /** Number of semester timeslots one instance of the module needs (module duration = n × slot length) */
  timeslots?: number
  curriculumVersionId?: string
  competencyIds?: string[]
  proofOfCompetencyIds?: string[]
}

export type ModuleExport = Module[]
