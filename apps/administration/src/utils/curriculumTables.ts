/** Shared v-data-table header rows of the curriculum view. Kept as pure data
 * so the view script stays focused on behaviour. */
export const deptHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

export const progHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Departments', key: 'departmentIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

export const degHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Programs', key: 'ProgramIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

export const modHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Degrees', key: 'DegreeIDs', sortable: false },
  { title: 'Classes', key: 'classCount', sortable: true },
  { title: 'ECTS', key: 'creditPoints', sortable: true },
  { title: 'Timeslots', key: 'timeslots', sortable: true },
  { title: 'Installments', key: 'installments', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

export const clsHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Degree', key: 'degreeId', sortable: false },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Semester', key: 'semesterId', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

export const semHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Start', key: 'startDate', sortable: true },
  { title: 'End', key: 'endDate', sortable: true },
  { title: 'Timeslots', key: 'slotStartTimes', sortable: false },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

export const currHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Versions', key: 'versionCount', sortable: true },
  { title: 'Active', key: 'activeVersion', sortable: false },
  { title: 'Programs', key: 'programCount', sortable: true },
  { title: 'Modules', key: 'moduleCount', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

/** ISO date string → short localized date, '-' for empty input. */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}