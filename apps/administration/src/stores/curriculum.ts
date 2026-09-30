import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { Room } from '@/types/room'
import type { Location } from '@/types/location'
import type { Department, Program, Degree, Module, ModuleConstraint } from '@/types/curriculum'
import type { LecturerAvailability, SchedulingRule } from '@/types/schedule'
import type { MatrixCompetency } from '@/types/matrixCompetency'
import type { CompetencyMatrix } from '@/types/competencyMatrix'
import type { RoomAvailability } from '@/types/roomAvailability'
import type { Week } from '@/types/week'
import type { ScheduleEntry } from '@/types/scheduleEntry'

export type { Department, Program, Degree, Module, ModuleConstraint }
export type { LecturerAvailability, SchedulingRule }

export interface CurriculumVersion {
  _id?: string
  id?: string
  name: string
  description?: string
  versionNumber: number
  /** @deprecated Use versionNumber instead */
  version?: number
  programId?: string
  createdAt?: string
}

export interface Semester {
  _id?: string
  id?: string
  name?: string
  code?: string
  startDate: string
  endDate: string
}

export interface Lesson {
  _id?: string
  id?: string
  moduleId: string
  name: string
  description?: string
  taxonomyItemIds?: string[]
  proofOfCompetencyIds?: string[]
}

export interface Lecturer {
  _id?: string
  id?: string
  name: string
  userId?: string
  departmentId?: string
  moduleIds?: string[]
}

export interface TaxonomyItem {
  _id?: string
  id?: string
  name: string
  description?: string
  category: 'competency' | 'learningObjective' | 'proofOfCompetency'
}

export const useCurriculumStore = defineStore('curriculum', () => {
  const { fetchEntities } = usePostgres()

  const curriculumVersions = ref<CurriculumVersion[]>([])
  const departments = ref<Department[]>([])
  const programs = ref<Program[]>([])
  const degrees = ref<Degree[]>([])
  const modules = ref<Module[]>([])
  const semesters = ref<Semester[]>([])
  const lessons = ref<Lesson[]>([])
  const rooms = ref<Room[]>([])
  const locations = ref<Location[]>([])
  const lecturers = ref<Lecturer[]>([])
  const lecturerAvailabilities = ref<LecturerAvailability[]>([])
  const schedulingRules = ref<SchedulingRule[]>([])
  const taxonomyItems = ref<TaxonomyItem[]>([])
  const competencyMatrices = ref<CompetencyMatrix[]>([])
  const matrixCompetencies = ref<MatrixCompetency[]>([])
  const roomAvailabilities = ref<RoomAvailability[]>([])
  const weeks = ref<Week[]>([])
  const scheduleEntries = ref<ScheduleEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDepartments() {
    loading.value = true
    error.value = null
    try {
      departments.value = await fetchEntities<Department>(EntityTables.DEPARTMENT)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchPrograms() {
    loading.value = true
    error.value = null
    try {
      programs.value = await fetchEntities<Program>(EntityTables.PROGRAM)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchDegrees() {
    loading.value = true
    error.value = null
    try {
      degrees.value = await fetchEntities<Degree>(EntityTables.DEGREE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchCurriculumVersions() {
    loading.value = true
    error.value = null
    try {
      curriculumVersions.value = await fetchEntities<CurriculumVersion>(EntityTables.CURRICULUM_VERSION)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchModules() {
    loading.value = true
    error.value = null
    try {
      modules.value = await fetchEntities<Module>(EntityTables.MODULE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchSemesters() {
    loading.value = true
    error.value = null
    try {
      semesters.value = await fetchEntities<Semester>(EntityTables.SEMESTER)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchLessons() {
    loading.value = true
    error.value = null
    try {
      lessons.value = await fetchEntities<Lesson>(EntityTables.LESSON)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchRooms() {
    loading.value = true
    error.value = null
    try {
      rooms.value = await fetchEntities<Room>(EntityTables.ROOM)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchLocations() {
    loading.value = true
    error.value = null
    try {
      locations.value = await fetchEntities<Location>(EntityTables.LOCATION)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchLecturers() {
    loading.value = true
    error.value = null
    try {
      lecturers.value = await fetchEntities<Lecturer>(EntityTables.LECTURER)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchLecturerAvailabilities() {
    loading.value = true
    error.value = null
    try {
      lecturerAvailabilities.value = await fetchEntities<LecturerAvailability>(EntityTables.LECTURER_AVAILABILITY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchSchedulingRules() {
    loading.value = true
    error.value = null
    try {
      schedulingRules.value = await fetchEntities<SchedulingRule>(EntityTables.SCHEDULING_RULE)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchTaxonomyItems() {
    loading.value = true
    error.value = null
    try {
      taxonomyItems.value = await fetchEntities<TaxonomyItem>(EntityTables.TAXONOMY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchCompetencyMatrices() {
    loading.value = true
    error.value = null
    try {
      competencyMatrices.value = await fetchEntities<CompetencyMatrix>(EntityTables.COMPETENCY_MATRIX)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchMatrixCompetencies() {
    loading.value = true
    error.value = null
    try {
      matrixCompetencies.value = await fetchEntities<MatrixCompetency>(EntityTables.MATRIX_COMPETENCY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchRoomAvailabilities() {
    loading.value = true
    error.value = null
    try {
      roomAvailabilities.value = await fetchEntities<RoomAvailability>(EntityTables.ROOM_AVAILABILITY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchWeeks() {
    loading.value = true
    error.value = null
    try {
      weeks.value = await fetchEntities<Week>(EntityTables.WEEK)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchScheduleEntries() {
    loading.value = true
    error.value = null
    try {
      scheduleEntries.value = await fetchEntities<ScheduleEntry>(EntityTables.SCHEDULE_ENTRY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return {
    curriculumVersions,
    departments,
    programs,
    degrees,
    modules,
    semesters,
    lessons,
    rooms,
    locations,
    lecturers,
    lecturerAvailabilities,
    schedulingRules,
    taxonomyItems,
    competencyMatrices,
    matrixCompetencies,
    roomAvailabilities,
    weeks,
    scheduleEntries,
    loading,
    error,
    fetchCurriculumVersions,
    fetchDepartments,
    fetchPrograms,
    fetchDegrees,
    fetchModules,
    fetchSemesters,
    fetchLessons,
    fetchRooms,
    fetchLocations,
    fetchLecturers,
    fetchLecturerAvailabilities,
    fetchSchedulingRules,
    fetchTaxonomyItems,
    fetchCompetencyMatrices,
    fetchMatrixCompetencies,
    fetchRoomAvailabilities,
    fetchWeeks,
    fetchScheduleEntries,
  }
})