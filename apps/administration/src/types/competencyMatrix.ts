import type { AclInfo } from '@/types/curriculum'

export interface CompetencyMatrix extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
}

export type CompetencyMatrixExport = CompetencyMatrix[]