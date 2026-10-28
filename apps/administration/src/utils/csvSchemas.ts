import type { ImportType, ImportTypeConfig, ImportFieldDefinition, ColumnMapping } from '@/types/csvImport'
import type { Department, Program, Degree, Module } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'

export function normalizeHeader(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseStringArray(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean)
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.map(String).map(s => s.trim()).filter(Boolean)
        }
      } catch {
        // fallback to delimiter split
      }
    }
    return trimmed
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  return [String(val).trim()].filter(Boolean)
}

export function autoMapColumns(headers: string[], fields: ImportFieldDefinition[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedHeaders = new Set<string>()

  // 1. Pass 1: Try exact or alias matches
  for (const field of fields) {
    const fieldNorm = normalizeHeader(field.key)
    const labelNorm = normalizeHeader(field.label)
    const aliasesNorm = field.aliases.map(normalizeHeader)

    let matchedHeader: string | null = null

    // Exact header match first
    for (const h of headers) {
      if (usedHeaders.has(h)) continue
      const hNorm = normalizeHeader(h)
      if (hNorm === fieldNorm || hNorm === labelNorm || aliasesNorm.includes(hNorm)) {
        matchedHeader = h
        break
      }
    }

    if (matchedHeader) {
      mapping[field.key] = matchedHeader
      usedHeaders.add(matchedHeader)
    } else {
      mapping[field.key] = null
    }
  }

  return mapping
}

/** CSV import covers the curriculum entities the generic API serves.
 *  Rooms, locations, availability and schedule entries are managed by the
 *  scheduling app and are not importable here. */
export const IMPORT_CONFIGS: Record<ImportType, ImportTypeConfig> = {
  departments: {
    type: 'departments',
    label: 'Departments',
    icon: 'mdi-domain',
    description: 'Academic departments, faculties, or administrative units.',
    entityName: 'Department',
    fields: [
      {
        key: 'name',
        label: 'Department Name',
        required: true,
        type: 'string',
        description: 'Name of the department',
        aliases: ['name', 'department_name', 'department name', 'departement', 'dept_name', 'title', 'fachbereich', 'institut'],
      },
      {
        key: 'id',
        label: 'Department ID',
        required: false,
        type: 'string',
        description: 'Unique department identifier',
        aliases: ['id', 'department_id', 'department id', 'dept_id', 'identifier', 'code', 'kuerzel'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description of the department',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or email address',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner', 'leitung'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the department',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Department[] => {
      return mappedRows.map(obj => {
        const dept: Department = {
          name: String(obj.name || ''),
        }
        if (obj.id) dept.id = String(obj.id)
        if (obj.description) dept.description = String(obj.description)
        if (obj.contact) dept.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          dept.url = String(urlVal)
          dept.URL = String(urlVal)
        }
        return dept
      })
    },
  },

  programs: {
    type: 'programs',
    label: 'Programs',
    icon: 'mdi-school-outline',
    description: 'Structured courses of study and academic programs.',
    entityName: 'Program',
    fields: [
      {
        key: 'name',
        label: 'Program Name',
        required: true,
        type: 'string',
        description: 'Name of the program',
        aliases: ['name', 'program_name', 'program name', 'studiengang', 'study_program', 'title'],
      },
      {
        key: 'id',
        label: 'Program ID',
        required: false,
        type: 'string',
        description: 'Unique program identifier',
        aliases: ['id', 'program_id', 'program id', 'studiengang_id', 'identifier', 'code', 'kuerzel'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the program',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'departmentIDs',
        label: 'Department IDs',
        required: false,
        type: 'string',
        description: 'Referenced department IDs (comma, semicolon, or pipe separated). Unknown IDs must be resolved during import.',
        aliases: [
          'departmentids',
          'department_ids',
          'department ids',
          'departmentid',
          'department_id',
          'departments',
          'department',
          'departement',
          'dept_ids',
          'dept_id',
        ],
        reference: {
          entityTable: 'departments',
          entityLabel: 'Department',
          requireAdmin: false,
          required: false,
        },
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or email address',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner', 'studiengangsleitung'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the program',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Program[] => {
      return mappedRows.map(obj => {
        const prog: Program = {
          name: String(obj.name || ''),
        }
        if (obj.id) prog.id = String(obj.id)
        if (obj.description) prog.description = String(obj.description)
        const deptIds = parseStringArray(obj.departmentIDs || obj.departmentIds)
        if (deptIds.length > 0) {
          prog.departmentIDs = deptIds
          prog.departmentIds = deptIds
        }
        if (obj.contact) prog.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          prog.url = String(urlVal)
          prog.URL = String(urlVal)
        }
        return prog
      })
    },
  },

  degrees: {
    type: 'degrees',
    label: 'Degrees',
    icon: 'mdi-certificate-outline',
    description: 'Academic qualifications awarded upon program completion.',
    entityName: 'Degree',
    fields: [
      {
        key: 'name',
        label: 'Degree Name',
        required: true,
        type: 'string',
        description: 'Name of the degree qualification (e.g. Bachelor of Science)',
        aliases: ['name', 'degree_name', 'degree name', 'abschluss', 'degree', 'title', 'titel', 'abschlussbezeichnung'],
      },
      {
        key: 'id',
        label: 'Degree ID',
        required: false,
        type: 'string',
        description: 'Unique degree identifier',
        aliases: ['id', 'degree_id', 'degree id', 'abschluss_id', 'identifier', 'code', 'kuerzel'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the degree',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'ProgramIDs',
        label: 'Program IDs',
        required: false,
        type: 'string',
        description: 'Referenced program IDs (comma, semicolon, or pipe separated). Each degree requires at least one program; unknown IDs must be resolved during import.',
        aliases: [
          'programids',
          'program_ids',
          'program ids',
          'programid',
          'program_id',
          'programs',
          'program',
          'studiengaenge',
          'studiengang',
          'studiengang_ids',
        ],
        reference: {
          entityTable: 'programs',
          entityLabel: 'Program',
          requireAdmin: true,
          required: true,
        },
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or email address',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the degree',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Degree[] => {
      return mappedRows.map(obj => {
        const deg: Degree = {
          name: String(obj.name || ''),
        }
        if (obj.id) deg.id = String(obj.id)
        if (obj.description) deg.description = String(obj.description)
        const progIds = parseStringArray(obj.ProgramIDs || obj.programIDs || obj.programIds)
        if (progIds.length > 0) {
          deg.ProgramIDs = progIds
          deg.programIDs = progIds
          deg.programIds = progIds
        }
        if (obj.contact) deg.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          deg.url = String(urlVal)
          deg.URL = String(urlVal)
        }
        return deg
      })
    },
  },

  modules: {
    type: 'modules',
    label: 'Modules',
    icon: 'mdi-book-open-page-variant',
    description: 'Curriculum modules, degree associations, credits, lesson length, and installments.',
    entityName: 'Module',
    fields: [
      {
        key: 'name',
        label: 'Module Name',
        required: true,
        type: 'string',
        description: 'Full name of the module',
        aliases: ['name', 'module_name', 'module name', 'modul', 'modulname', 'title'],
      },
      {
        key: 'id',
        label: 'Module ID / Code',
        required: false,
        type: 'string',
        description: 'Unique module identifier or code (e.g. CS101)',
        aliases: ['id', 'code', 'module_code', 'module code', 'kuerzel', 'modulcode', 'identifier'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Module overview and syllabus',
        aliases: ['description', 'beschreibung', 'syllabus', 'details', 'desc', 'summary'],
      },
      {
        key: 'DegreeIDs',
        label: 'Degree IDs',
        required: false,
        type: 'string',
        description: 'Referenced degree IDs (comma, semicolon, or pipe separated). Each module requires at least one degree; unknown IDs must be resolved during import.',
        aliases: [
          'degreeids',
          'degree_ids',
          'degree ids',
          'degreeid',
          'degree_id',
          'degrees',
          'degree',
          'degree_programmes',
          'abschluesse',
          'abschluss',
          'abschluss_ids',
        ],
        reference: {
          entityTable: 'degrees',
          entityLabel: 'Degree',
          requireAdmin: true,
          required: true,
        },
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person or lecturer responsible for the module',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'lecturer', 'dozent', 'responsible', 'person', 'ansprechpartner'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or syllabus URL of the module',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
      {
        key: 'creditPoints',
        label: 'Credit Points (ECTS)',
        required: false,
        type: 'number',
        description: 'ECTS credits',
        aliases: ['creditpoints', 'credit_points', 'credits', 'ects', 'points'],
      },
      {
        key: 'timeslots',
        label: 'Timeslots per Installment',
        required: false,
        type: 'number',
        description: 'Number of semester timeslots one installment of the module lasts (duration = n × slot length)',
        aliases: ['timeslots', 'timeslotcount', 'timeslot_count', 'timeslotsperinstallment', 'slots', 'lessonlength', 'lesson_length'],
      },
      {
        key: 'installments',
        label: 'Installments per Semester',
        required: false,
        type: 'number',
        description: 'How many separate installments of the module are taught per semester (unset = 1)',
        aliases: ['installments', 'installmentcount', 'installment_count', 'installmentspersemester', 'sessionspersemester', 'sessions_per_semester'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Module[] => {
      return mappedRows.map(obj => {
        const mod: Module = {
          name: String(obj.name || ''),
        }
        if (obj.id) mod.id = String(obj.id)
        if (obj.code || obj.id) mod.code = String(obj.code || obj.id)
        if (obj.description) mod.description = String(obj.description)
        const degreeIds = parseStringArray(obj.DegreeIDs || obj.degreeIDs || obj.degreeIds)
        if (degreeIds.length > 0) {
          mod.DegreeIDs = degreeIds
          mod.degreeIDs = degreeIds
          mod.degreeIds = degreeIds
        }
        if (obj.curriculumVersionId) mod.curriculumVersionId = String(obj.curriculumVersionId)
        if (obj.contact) mod.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          mod.url = String(urlVal)
          mod.URL = String(urlVal)
        }
        if (obj.creditPoints !== undefined && obj.creditPoints !== '') {
          mod.creditPoints = Number(obj.creditPoints) || undefined
        }
        if (obj.timeslots !== undefined && obj.timeslots !== '') {
          mod.timeslots = Number(obj.timeslots) || undefined
        }
        if (obj.installments !== undefined && obj.installments !== '') {
          mod.installments = Number(obj.installments) || undefined
        }
        return mod
      })
    },
  },

  classes: {
    type: 'classes',
    label: 'Classes',
    icon: 'mdi-account-group',
    description: 'Student groups/cohorts with semester, degree, module assignments and size.',
    entityName: 'Class',
    fields: [
      {
        key: 'name',
        label: 'Class Name',
        required: true,
        type: 'string',
        description: 'Name of the student group or cohort (e.g. 1BINF-2024)',
        aliases: ['name', 'class_name', 'class name', 'klasse', 'klassenname', 'cohort', 'group', 'gruppe', 'title', 'titel'],
      },
      {
        key: 'id',
        label: 'Class ID / Code',
        required: false,
        type: 'string',
        description: 'Unique class identifier or code (e.g. 1BINF24)',
        aliases: ['id', 'code', 'class_code', 'class code', 'class_id', 'class id', 'kuerzel', 'klassencode', 'identifier'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the class',
        aliases: ['description', 'beschreibung', 'details', 'desc', 'summary'],
      },
      {
        key: 'semesterId',
        label: 'Semester',
        required: false,
        type: 'string',
        description: 'Referenced semester ID (intake semester). Unknown IDs must be resolved during import.',
        aliases: ['semesterid', 'semester_id', 'semester id', 'semester', 'semestercode', 'semester_name', 'semestername'],
        reference: {
          entityTable: 'semesters',
          entityLabel: 'Semester',
          requireAdmin: false,
          required: false,
        },
      },
      {
        key: 'degreeId',
        label: 'Degree',
        required: false,
        type: 'string',
        description: 'Referenced degree ID (the degree of this class). Unknown IDs must be resolved during import.',
        aliases: ['degreeid', 'degree_id', 'degree id', 'degree', 'degrees', 'abschluss', 'abschluss_id', 'abschlussids'],
        reference: {
          entityTable: 'degrees',
          entityLabel: 'Degree',
          requireAdmin: false,
          required: false,
        },
      },
      {
        key: 'moduleIds',
        label: 'Module IDs',
        required: false,
        type: 'string',
        description: 'Referenced module IDs (comma, semicolon, or pipe separated): the modules this class attends.',
        aliases: ['moduleids', 'module_ids', 'module ids', 'moduleid', 'modules', 'module', 'modul', 'module_ids'],
        reference: {
          entityTable: 'modules',
          entityLabel: 'Module',
          requireAdmin: false,
          required: false,
        },
      },
      {
        key: 'size',
        label: 'Class Size',
        required: false,
        type: 'number',
        description: 'Number of students in this class',
        aliases: ['size', 'classsize', 'class_size', 'students', 'studentcount', 'student_count', 'participants', 'groesse'],
      },
      {
        key: 'contact',
        label: 'Contact',
        required: false,
        type: 'string',
        description: 'Contact person for the class',
        aliases: ['contact', 'kontakt', 'contact_person', 'email', 'person', 'ansprechpartner'],
      },
      {
        key: 'url',
        label: 'URL',
        required: false,
        type: 'string',
        description: 'Website or URL of the class',
        aliases: ['url', 'URL', 'link', 'website', 'webseite', 'uri', 'homepage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): ClassEntity[] => {
      return mappedRows.map(obj => {
        const cls: ClassEntity = {
          name: String(obj.name || ''),
        }
        if (obj.id) cls.id = String(obj.id)
        if (obj.code || obj.id) cls.code = String(obj.code || obj.id)
        if (obj.description) cls.description = String(obj.description)
        const semesterTokens = parseStringArray(obj.semesterId)
        if (semesterTokens.length > 0) cls.semesterId = String(semesterTokens[0])
        const degreeTokens = parseStringArray(obj.degreeId)
        if (degreeTokens.length > 0) cls.degreeId = String(degreeTokens[0])
        const moduleIds = parseStringArray(obj.moduleIds)
        if (moduleIds.length > 0) cls.moduleIds = moduleIds
        if (obj.contact) cls.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          cls.url = String(urlVal)
          cls.URL = String(urlVal)
        }
        if (obj.size !== undefined && obj.size !== '') {
          cls.size = Number(obj.size) || undefined
        }
        return cls
      })
    },
  },
}