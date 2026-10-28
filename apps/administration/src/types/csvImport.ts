export type ImportType =
  | 'departments'
  | 'programs'
  | 'degrees'
  | 'modules'
  | 'classes'

export type FieldDataType = 'string' | 'number' | 'boolean' | 'enum'

/** A field (or parts of it) holds IDs referencing other curriculum entities. */
export interface ReferenceTargetSpec {
  /** API table of the referenced entities */
  entityTable: 'departments' | 'programs' | 'degrees' | 'semesters' | 'modules'
  /** Display name of a single referenced element, e.g. "Department" */
  entityLabel: string
  /** The backend requires the importer to have admin access over the referenced entities */
  requireAdmin: boolean
  /** The backend rejects rows that reference nothing */
  required: boolean
}

export interface ImportFieldDefinition {
  key: string
  label: string
  required: boolean
  type: FieldDataType
  description?: string
  aliases: string[]
  options?: string[]
  defaultValue?: any
  reference?: ReferenceTargetSpec
}

export interface ImportTypeConfig {
  type: ImportType
  label: string
  icon: string
  description: string
  entityName: string
  fields: ImportFieldDefinition[]
  transform: (mappedRows: Record<string, any>[]) => any[]
}

export type ColumnMapping = Record<string, string | null> // entityFieldKey -> csvHeader (or null if unmapped)