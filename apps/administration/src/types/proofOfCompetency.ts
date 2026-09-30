import type { AclInfo } from '@/types/curriculum'

export type AnswerFormat = 'written' | 'oral' | 'multipleChoice' | 'freeText'

export interface ProofOfCompetency extends AclInfo {
  id?: string
  _id?: string
  name: string
  description?: string
  answerFormats?: AnswerFormat[]
  assignmentScope?: 'individual' | 'group' | string
  durationMinutes?: number
  competencyIds?: string[]
  created_at?: string
  updated_at?: string
}

export type ProofOfCompetencyExport = ProofOfCompetency[]