import type { AclInfo } from '@/types/curriculum'

export type SkillLevel = 'Introduction' | 'Regular' | 'Master' | 'I' | 'R' | 'M'

export interface Competency extends AclInfo {
  id?: string
  _id?: string
  name: string
  category?: string
  topic?: string
  description?: string
  level?: SkillLevel | string
  xMatrixCompetencyId?: string
  yMatrixCompetencyId?: string
}

export type CompetencyExport = Competency[]
