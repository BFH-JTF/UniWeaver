import type { AclInfo } from '@/types/curriculum'

export interface MatrixCompetency extends AclInfo {
  id?: string
  _id?: string
  competencyMatrixId?: string
  name: string
  category?: string
  description?: string
  level?: string
  matrixAxis: 'x' | 'y'
}

export type MatrixCompetencyExport = MatrixCompetency[]