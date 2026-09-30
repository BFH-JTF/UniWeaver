import type { ImportType, ImportTypeConfig, ImportFieldDefinition, ColumnMapping } from '@/types/csvImport'
import type { Room, RoomType, LayoutType } from '@/types/room'
import type { Location } from '@/types/location'
import type { Competency, SkillLevel } from '@/types/competency'
import type { Department, Program, Degree, Module } from '@/types/curriculum'
import type { ProofOfCompetency, AnswerFormat } from '@/types/proofOfCompetency'
import type { LecturerAvailability, SchedulingRule } from '@/types/schedule'
import type { MatrixCompetency } from '@/types/matrixCompetency'
import type { RoomAvailability } from '@/types/roomAvailability'
import type { Week } from '@/types/week'
import type { ScheduleEntry } from '@/types/scheduleEntry'

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

export const IMPORT_CONFIGS: Record<ImportType, ImportTypeConfig> = {
  rooms: {
    type: 'rooms',
    label: 'Rooms',
    icon: 'mdi-door-open',
    description: 'Classrooms, lecture halls, computer labs, and seminar rooms.',
    entityName: 'Room',
    fields: [
      {
        key: 'name',
        label: 'Room Name',
        required: true,
        type: 'string',
        description: 'Human-readable name (e.g., Science Building 204)',
        aliases: ['name', 'room_name', 'room name', 'classroom', 'room', 'title', 'raum', 'raumname'],
      },
      {
        key: 'room_number',
        label: 'Room Number',
        required: true,
        type: 'string',
        description: 'Official room number or designation (e.g., 204, B12)',
        aliases: ['room_number', 'room number', 'room_nr', 'room nr', 'roomno', 'room no', 'nr', 'number', 'raumnummer'],
      },
      {
        key: 'floor',
        label: 'Floor',
        required: true,
        type: 'string',
        description: 'Floor number or label (e.g., 2, 0, basement)',
        aliases: ['floor', 'level', 'etage', 'stockwerk', 'floor_number', 'floor number'],
      },
      {
        key: 'room_type',
        label: 'Room Type',
        required: true,
        type: 'enum',
        description: 'lecture_hall, classroom, computer_lab, laboratory, or other',
        options: ['lecture_hall', 'classroom', 'computer_lab', 'laboratory', 'other'],
        defaultValue: 'classroom',
        aliases: ['room_type', 'room type', 'type', 'raumtyp', 'category', 'kind'],
      },
      {
        key: 'capacity_seats',
        label: 'Seat Capacity',
        required: true,
        type: 'number',
        description: 'Maximum number of regular seats',
        aliases: ['capacity_seats', 'capacity seats', 'seats', 'capacity', 'max_seats', 'plaetze', 'sitzplaetze'],
      },
      {
        key: 'location_id',
        label: 'Location ID / Building Ref',
        required: false,
        type: 'string',
        description: 'Reference to Location entity or location ID',
        aliases: ['location_id', 'location id', 'location', 'standort', 'building_ref'],
      },
      {
        key: 'owner',
        label: 'Owner / Contact',
        required: false,
        type: 'string',
        description: 'Contact person or department responsible for the room',
        aliases: ['owner', 'contact', 'responsible', 'verantwortlicher'],
      },
      {
        key: 'capacity_accessible_seats',
        label: 'Accessible Seats',
        required: false,
        type: 'number',
        description: 'Number of wheelchair-accessible seats',
        aliases: ['capacity_accessible_seats', 'accessible_seats', 'accessible seats', 'rollstuhlplaetze'],
      },
      {
        key: 'capacity_desks',
        label: 'Desks Count',
        required: false,
        type: 'number',
        description: 'Number of desks or workstations',
        aliases: ['capacity_desks', 'desks', 'tische', 'workstations'],
      },
      {
        key: 'capacity_standing_capacity',
        label: 'Standing Capacity',
        required: false,
        type: 'number',
        description: 'Maximum number of additional standing occupants',
        aliases: ['capacity_standing_capacity', 'standing_capacity', 'standing capacity', 'stehplaetze'],
      },
      {
        key: 'layout_type',
        label: 'Layout Type',
        required: false,
        type: 'enum',
        description: 'rows, u_shape, boardroom, laboratory_benches, computer_workstations, other',
        options: ['rows', 'u_shape', 'boardroom', 'laboratory_benches', 'computer_workstations', 'other'],
        aliases: ['layout_type', 'layout type', 'layout', 'bestuhlung'],
      },
      {
        key: 'layout_movable_desks',
        label: 'Movable Desks',
        required: false,
        type: 'boolean',
        description: 'Whether desks can be rearranged (true/false)',
        aliases: ['layout_movable_desks', 'movable_desks', 'movable desks'],
      },
      {
        key: 'layout_movable_chairs',
        label: 'Movable Chairs',
        required: false,
        type: 'boolean',
        description: 'Whether chairs can be moved (true/false)',
        aliases: ['layout_movable_chairs', 'movable_chairs', 'movable chairs'],
      },
      {
        key: 'layout_group_work_possible',
        label: 'Group Work Possible',
        required: false,
        type: 'boolean',
        description: 'Whether room layout is suitable for group work',
        aliases: ['layout_group_work_possible', 'group_work_possible', 'group work'],
      },
      {
        key: 'layout_floor_area_m2',
        label: 'Floor Area (m²)',
        required: false,
        type: 'number',
        description: 'Total floor area in square meters',
        aliases: ['layout_floor_area_m2', 'floor_area_m2', 'floor area', 'area', 'flaeche', 'sqm'],
      },
      {
        key: 'equipment_whiteboards',
        label: 'Whiteboards Count',
        required: false,
        type: 'number',
        description: 'Number of whiteboard surfaces',
        aliases: ['equipment_whiteboards', 'whiteboards', 'whiteboard'],
      },
      {
        key: 'equipment_blackboard',
        label: 'Blackboard',
        required: false,
        type: 'boolean',
        description: 'Whether chalkboard is present',
        aliases: ['equipment_blackboard', 'blackboard', 'tafel'],
      },
      {
        key: 'equipment_flipchart',
        label: 'Flipchart',
        required: false,
        type: 'boolean',
        description: 'Whether flipchart is available',
        aliases: ['equipment_flipchart', 'flipchart'],
      },
      {
        key: 'equipment_smartboard',
        label: 'Smartboard',
        required: false,
        type: 'boolean',
        description: 'Whether interactive smartboard is installed',
        aliases: ['equipment_smartboard', 'smartboard'],
      },
      {
        key: 'equipment_projector',
        label: 'Projector (Beamer)',
        required: false,
        type: 'boolean',
        description: 'Whether a digital video projector is available',
        aliases: ['equipment_projector', 'projector', 'beamer'],
      },
      {
        key: 'equipment_projector_count',
        label: 'Projector Count',
        required: false,
        type: 'number',
        description: 'Number of installed projectors',
        aliases: ['equipment_projector_count', 'projector_count', 'projectors'],
      },
      {
        key: 'equipment_document_camera',
        label: 'Document Camera',
        required: false,
        type: 'boolean',
        description: 'Visualizer / document camera available',
        aliases: ['equipment_document_camera', 'document_camera', 'visualizer'],
      },
      {
        key: 'equipment_lectern',
        label: 'Lectern / Podium',
        required: false,
        type: 'boolean',
        description: 'Whether a speaker lectern is provided',
        aliases: ['equipment_lectern', 'lectern', 'podium', 'rednerpult'],
      },
      {
        key: 'equipment_speakers',
        label: 'Speakers (Audio)',
        required: false,
        type: 'boolean',
        description: 'Installed sound reinforcement speakers',
        aliases: ['equipment_speakers', 'speakers', 'sound_system', 'lautsprecher'],
      },
      {
        key: 'equipment_microphone',
        label: 'Microphone',
        required: false,
        type: 'boolean',
        description: 'Fixed or wireless microphone available',
        aliases: ['equipment_microphone', 'microphone', 'mic', 'mikrofon'],
      },
      {
        key: 'equipment_lecture_capture',
        label: 'Lecture Capture',
        required: false,
        type: 'boolean',
        description: 'Automated recording / streaming equipment installed',
        aliases: ['equipment_lecture_capture', 'lecture_capture', 'recording'],
      },
      {
        key: 'equipment_streaming_camera_available',
        label: 'Streaming Camera',
        required: false,
        type: 'boolean',
        description: 'Whether a streaming / webcam camera is available',
        aliases: ['equipment_streaming_camera_available', 'streaming_camera', 'camera', 'webcam'],
      },
      {
        key: 'equipment_video_conferencing_available',
        label: 'Video Conferencing',
        required: false,
        type: 'boolean',
        description: 'Integrated Zoom / Teams video conference system',
        aliases: ['equipment_video_conferencing_available', 'video_conferencing', 'videoconference', 'teams_room', 'zoom_room'],
      },
      {
        key: 'connectivity_wifi',
        label: 'WiFi Available',
        required: false,
        type: 'boolean',
        description: 'Wireless internet connectivity available',
        aliases: ['connectivity_wifi', 'wifi', 'wlan'],
      },
      {
        key: 'connectivity_wired_network',
        label: 'Wired Network (Ethernet)',
        required: false,
        type: 'boolean',
        description: 'Ethernet wall jacks available',
        aliases: ['connectivity_wired_network', 'wired_network', 'ethernet', 'lan'],
      },
      {
        key: 'connectivity_network_speed_mbps',
        label: 'Network Speed (Mbps)',
        required: false,
        type: 'number',
        description: 'Network bandwidth in Mbps',
        aliases: ['connectivity_network_speed_mbps', 'network_speed_mbps', 'network_speed', 'speed_mbps'],
      },
      {
        key: 'connectivity_power_outlets',
        label: 'Power Outlets Count',
        required: false,
        type: 'number',
        description: 'Number of accessible AC power sockets for students',
        aliases: ['connectivity_power_outlets', 'power_outlets', 'outlets', 'steckdosen'],
      },
      {
        key: 'accessibility_step_free_access',
        label: 'Step-Free Access',
        required: false,
        type: 'boolean',
        description: 'Wheelchair / step-free accessible entrance',
        aliases: ['accessibility_step_free_access', 'step_free_access', 'accessible', 'wheelchair', 'barrierefrei'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Room[] => {
      return mappedRows.map(obj => {
        const floorVal = obj.floor ?? '0'
        const floorNum = Number(floorVal)
        const floor = isNaN(floorNum) ? String(floorVal) : floorNum

        let room_type: RoomType = 'classroom'
        const rt = (obj.room_type || '').toLowerCase().trim()
        if (['lecture_hall', 'classroom', 'computer_lab', 'laboratory', 'other'].includes(rt)) {
          room_type = rt as RoomType
        }

        const room: Room = {
          name: String(obj.name || ''),
          roomType: room_type,
          floor,
          roomNumber: String(obj.room_number || ''),
          capacity: Number(obj.capacity_seats) || 0,
          accessibility: {
            step_free_access: parseBoolean(obj.accessibility_step_free_access),
          },
        }

        if (obj.location_id) room.locationId = String(obj.location_id)
        if (obj.owner) room.owner = String(obj.owner)

        const layout: any = {}
        if (obj.layout_type) {
          const lt = String(obj.layout_type).toLowerCase().trim()
          if (['rows', 'u_shape', 'boardroom', 'laboratory_benches', 'computer_workstations', 'other'].includes(lt)) {
            layout.type = lt as LayoutType
          }
        }
        if (obj.layout_movable_desks !== undefined && obj.layout_movable_desks !== '') {
          layout.movable_desks = parseBoolean(obj.layout_movable_desks)
        }
        if (obj.layout_movable_chairs !== undefined && obj.layout_movable_chairs !== '') {
          layout.movable_chairs = parseBoolean(obj.layout_movable_chairs)
        }
        if (obj.layout_group_work_possible !== undefined && obj.layout_group_work_possible !== '') {
          layout.group_work_possible = parseBoolean(obj.layout_group_work_possible)
        }
        if (obj.layout_floor_area_m2 !== undefined && obj.layout_floor_area_m2 !== '') {
          layout.floor_area_m2 = Number(obj.layout_floor_area_m2) || undefined
        }
        if (Object.keys(layout).length > 0) room.layout = layout

        const equipment: any = {}
        if (obj.equipment_whiteboards !== undefined && obj.equipment_whiteboards !== '') {
          equipment.whiteboards = Number(obj.equipment_whiteboards) || 0
        }
        if (obj.equipment_blackboard !== undefined && obj.equipment_blackboard !== '') {
          equipment.blackboard = parseBoolean(obj.equipment_blackboard)
        }
        if (obj.equipment_flipchart !== undefined && obj.equipment_flipchart !== '') {
          equipment.flipchart = parseBoolean(obj.equipment_flipchart)
        }
        if (obj.equipment_smartboard !== undefined && obj.equipment_smartboard !== '') {
          equipment.smartboard = parseBoolean(obj.equipment_smartboard)
        }
        if (obj.equipment_projector !== undefined && obj.equipment_projector !== '') {
          equipment.projector = parseBoolean(obj.equipment_projector)
        }
        if (obj.equipment_projector_count !== undefined && obj.equipment_projector_count !== '') {
          equipment.projector_count = Number(obj.equipment_projector_count) || undefined
        }
        if (obj.equipment_document_camera !== undefined && obj.equipment_document_camera !== '') {
          equipment.document_camera = parseBoolean(obj.equipment_document_camera)
        }
        if (obj.equipment_lectern !== undefined && obj.equipment_lectern !== '') {
          equipment.lectern = parseBoolean(obj.equipment_lectern)
        }
        if (obj.equipment_speakers !== undefined && obj.equipment_speakers !== '') {
          equipment.speakers = parseBoolean(obj.equipment_speakers)
        }
        if (obj.equipment_microphone !== undefined && obj.equipment_microphone !== '') {
          equipment.microphone = parseBoolean(obj.equipment_microphone)
        }
        if (obj.equipment_lecture_capture !== undefined && obj.equipment_lecture_capture !== '') {
          equipment.lecture_capture = parseBoolean(obj.equipment_lecture_capture)
        }
        if (obj.equipment_streaming_camera_available !== undefined && obj.equipment_streaming_camera_available !== '') {
          equipment.streaming_camera = { available: parseBoolean(obj.equipment_streaming_camera_available) }
        }
        if (obj.equipment_video_conferencing_available !== undefined && obj.equipment_video_conferencing_available !== '') {
          equipment.video_conferencing = { available: parseBoolean(obj.equipment_video_conferencing_available) }
        }
        if (Object.keys(equipment).length > 0) room.equipment = equipment

        const connectivity: any = {}
        if (obj.connectivity_wifi !== undefined && obj.connectivity_wifi !== '') {
          connectivity.wifi = parseBoolean(obj.connectivity_wifi)
        }
        if (obj.connectivity_wired_network !== undefined && obj.connectivity_wired_network !== '') {
          connectivity.wired_network = parseBoolean(obj.connectivity_wired_network)
        }
        if (obj.connectivity_network_speed_mbps !== undefined && obj.connectivity_network_speed_mbps !== '') {
          connectivity.network_speed_mbps = Number(obj.connectivity_network_speed_mbps) || undefined
        }
        if (obj.connectivity_power_outlets !== undefined && obj.connectivity_power_outlets !== '') {
          connectivity.power_outlets = Number(obj.connectivity_power_outlets) || undefined
        }
        if (Object.keys(connectivity).length > 0) room.connectivity = connectivity

        return room
      })
    },
  },

  locations: {
    type: 'locations',
    label: 'Locations',
    icon: 'mdi-map-marker',
    description: 'Campuses, buildings, and geographic sites.',
    entityName: 'Location',
    fields: [
      {
        key: 'name',
        label: 'Location Name',
        required: true,
        type: 'string',
        description: 'Human-readable name (e.g., North Campus, Science Building)',
        aliases: ['name', 'location_name', 'location name', 'location', 'site', 'standort', 'bezeichnung'],
      },
      {
        key: 'building',
        label: 'Building',
        required: true,
        type: 'string',
        description: 'Building name or code (e.g., Science Building, Main Building)',
        aliases: ['building', 'building_name', 'building name', 'gebaeude', 'house', 'haus'],
      },
      {
        key: 'campus',
        label: 'Campus',
        required: false,
        type: 'string',
        description: 'Campus name or code (e.g., North Campus, Campus Bern)',
        aliases: ['campus', 'campus_name', 'areal', 'site_name'],
      },
      {
        key: 'address',
        label: 'Address',
        required: false,
        type: 'string',
        description: 'Postal or street address',
        aliases: ['address', 'street', 'strasse', 'adresse', 'postal_address'],
      },
      {
        key: 'latitude',
        label: 'Latitude',
        required: false,
        type: 'number',
        description: 'Geographic latitude in decimal degrees (e.g. 52.5201)',
        aliases: ['latitude', 'lat', 'breitengrad'],
      },
      {
        key: 'longitude',
        label: 'Longitude',
        required: false,
        type: 'number',
        description: 'Geographic longitude in decimal degrees (e.g. 13.4049)',
        aliases: ['longitude', 'lon', 'lng', 'laengengrad'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Location[] => {
      return mappedRows.map(obj => {
        const loc: Location = {
          name: String(obj.name || ''),
          building: String(obj.building || ''),
        }
        if (obj.campus) loc.campus = String(obj.campus)
        if (obj.address) loc.address = String(obj.address)
        if (obj.latitude !== undefined && obj.latitude !== '') {
          loc.latitude = Number(obj.latitude) || undefined
        }
        if (obj.longitude !== undefined && obj.longitude !== '') {
          loc.longitude = Number(obj.longitude) || undefined
        }
        return loc
      })
    },
  },

  competencies: {
    type: 'competencies',
    label: 'Competencies',
    icon: 'mdi-school',
    description: 'Competencies, topics, and taxonomy learning objectives.',
    entityName: 'Competency',
    fields: [
      {
        key: 'name',
        label: 'Competency / Topic Name',
        required: true,
        type: 'string',
        description: 'Name of the competency or topic',
        aliases: ['name', 'topic', 'competency', 'title', 'kompetenz', 'thema', 'bezeichnung', 'knowledge_area'],
      },
      {
        key: 'category',
        label: 'Category',
        required: false,
        type: 'string',
        description: 'e.g. Knowledge Area, Subject-Specific Skill, Generic Skill',
        aliases: ['category', 'kategorie', 'area', 'group', 'type'],
      },
      {
        key: 'topic',
        label: 'Topic / Sub-theme',
        required: false,
        type: 'string',
        description: 'Specific topic under category',
        aliases: ['topic', 'subtopic', 'unterthema', 'subject'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description of the competency',
        aliases: ['description', 'beschreibung', 'details', 'definition', 'desc', 'learning_outcome'],
      },
      {
        key: 'level',
        label: 'Skill Level',
        required: false,
        type: 'enum',
        description: 'Introduction (I), Regular (R), Master (M)',
        options: ['Introduction', 'Regular', 'Master', 'I', 'R', 'M'],
        aliases: ['level', 'skill_level', 'niveau', 'stufe', 'kompetenzstufe'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Competency[] => {
      return mappedRows.map(obj => {
        const name = String(obj.name || obj.topic || obj.category || 'Unnamed Competency')
        const comp: Competency = {
          name,
        }
        if (obj.category) comp.category = String(obj.category)
        if (obj.topic) comp.topic = String(obj.topic)
        if (obj.description) comp.description = String(obj.description)
        if (obj.level) comp.level = String(obj.level) as SkillLevel
        return comp
      })
    },
  },

  modules: {
    type: 'modules',
    label: 'Modules',
    icon: 'mdi-book-open-page-variant',
    description: 'Curriculum modules, degree associations, credits, and contact hours.',
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
        description: 'Referenced degree IDs (comma, semicolon, or pipe separated)',
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
        key: 'contactHours',
        label: 'Contact Hours',
        required: false,
        type: 'number',
        description: 'Classroom teaching hours',
        aliases: ['contacthours', 'contact_hours', 'contact hours', 'kontaktzeit', 'praesenz'],
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
        if (obj.contact) mod.contact = String(obj.contact)
        const urlVal = obj.url || obj.URL
        if (urlVal) {
          mod.url = String(urlVal)
          mod.URL = String(urlVal)
        }
        if (obj.creditPoints !== undefined && obj.creditPoints !== '') {
          mod.creditPoints = Number(obj.creditPoints) || undefined
        }
        if (obj.contactHours !== undefined && obj.contactHours !== '') {
          mod.contactHours = Number(obj.contactHours) || undefined
        }
        return mod
      })
    },
  },

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
        description: 'Referenced department IDs (comma, semicolon, or pipe separated)',
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
        description: 'Referenced program IDs (comma, semicolon, or pipe separated)',
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

  proofs_of_competency: {
    type: 'proofs_of_competency',
    label: 'Proofs of Competency',
    icon: 'mdi-file-certificate-outline',
    description: 'Assessment methods, exams, assignments, and duration.',
    entityName: 'Proof of Competency',
    fields: [
      {
        key: 'name',
        label: 'Name',
        required: true,
        type: 'string',
        description: 'Name or title of the proof of competency (e.g. Final Written Exam)',
        aliases: ['name', 'title', 'bezeichnung', 'pruefung', 'exam', 'assessment', 'proof', 'proof_name'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Detailed description or criteria for the assessment',
        aliases: ['description', 'beschreibung', 'details', 'criteria', 'desc'],
      },
      {
        key: 'answerFormats',
        label: 'Answer Formats',
        required: false,
        type: 'enum',
        description: 'Comma/pipe separated list: written, oral, multipleChoice, freeText',
        options: ['written', 'oral', 'multipleChoice', 'freeText', 'Written', 'Oral', 'Multiple Choice', 'Free Text', 'schriftlich', 'muendlich'],
        aliases: ['answerformats', 'answer_formats', 'answer formats', 'formats', 'format', 'assessmenttype', 'assessment_type', 'multiplechoice', 'multiple_choice', 'freetext', 'free_text', 'art', 'form'],
      },
      {
        key: 'assignmentScope',
        label: 'Assignment Type (Individual / Group)',
        required: false,
        type: 'enum',
        description: 'individual or group',
        options: ['individual', 'group', 'Individual', 'Group', 'einzelarbeit', 'gruppenarbeit'],
        defaultValue: 'individual',
        aliases: ['assignmentscope', 'assignment_scope', 'assignment_type', 'individual_group', 'group_assignment', 'scope'],
      },
      {
        key: 'durationMinutes',
        label: 'Duration of Test (min)',
        required: false,
        type: 'number',
        description: 'Test duration in minutes',
        aliases: ['durationminutes', 'duration_minutes', 'duration', 'dauer', 'pruefungsdauer', 'minutes', 'minuten', 'zeit'],
      },
      {
        key: 'competencyIds',
        label: 'Competency IDs',
        required: false,
        type: 'string',
        description: 'Referenced competency IDs (comma, semicolon, or pipe separated)',
        aliases: ['competencyids', 'competency_ids', 'competency ids', 'competencyid', 'competency_id', 'competencies', 'kompetenzen'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): ProofOfCompetency[] => {
      return mappedRows.map(obj => {
        const formats: AnswerFormat[] = []
        const raw = obj.answerFormats !== undefined
          ? obj.answerFormats
          : [obj.written, obj.oral].filter(v => v !== undefined && v !== '')
        for (const f of parseStringArray(raw)) {
          const norm = f.toLowerCase().replace(/[\s_-]/g, '')
          if (norm === 'written' || norm === 'schriftlich') formats.push('written')
          else if (norm === 'oral' || norm === 'muendlich') formats.push('oral')
          else if (norm === 'multiplechoice' || norm === 'mc') formats.push('multipleChoice')
          else if (norm === 'freetext' || norm === 'essay') formats.push('freeText')
        }

        let assignmentScope: 'individual' | 'group' = 'individual'
        const as = String(obj.assignmentScope || '').toLowerCase().trim()
        if (as.includes('group') || as.includes('grupp')) {
          assignmentScope = 'group'
        }

        const proof: ProofOfCompetency = {
          name: String(obj.name || 'Unnamed Proof of Competency'),
          answerFormats: formats,
          assignmentScope,
        }

        if (obj.description) proof.description = String(obj.description)
        if (obj.durationMinutes !== undefined && obj.durationMinutes !== '') {
          proof.durationMinutes = Number(obj.durationMinutes) || undefined
        }
        const compIds = parseStringArray(obj.competencyIds)
        if (compIds.length > 0) proof.competencyIds = compIds

        return proof
      })
    },
  },

  availability: {
    type: 'availability',
    label: 'Lecturer Availability',
    icon: 'mdi-calendar-clock',
    description: 'Recurring weekly availability for lecturers.',
    entityName: 'Availability',
    fields: [
      {
        key: 'lecturerId',
        label: 'Lecturer ID',
        required: true,
        type: 'string',
        description: 'ID or name of the lecturer',
        aliases: ['lecturer_id', 'lecturer id', 'lecturer', 'dozent', 'dozentid', 'instructor', 'instructor_id', 'teacher'],
      },
      {
        key: 'weekId',
        label: 'Week ID',
        required: false,
        type: 'string',
        description: 'ID of the week this availability slot applies to',
        aliases: ['week_id', 'week id', 'week', 'woche'],
      },
      {
        key: 'weekday',
        label: 'Weekday',
        required: false,
        type: 'enum',
        description: 'Day of the week for recurring availability',
        options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
          'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag',
          'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        aliases: ['weekday', 'day', 'day_of_week', 'wochentag', 'tag', 'dayofweek'],
      },
      {
        key: 'startTime',
        label: 'Start Time',
        required: false,
        type: 'string',
        description: 'Start time of availability slot (HH:MM format)',
        aliases: ['start_time', 'start', 'von', 'begin', 'beginn', 'start_time'],
      },
      {
        key: 'endTime',
        label: 'End Time',
        required: false,
        type: 'string',
        description: 'End time of availability slot (HH:MM format)',
        aliases: ['end_time', 'end', 'bis', 'ende', 'end_time'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): LecturerAvailability[] => {
      return mappedRows.map(row => {
        let wd = String(row.weekday || 'monday').toLowerCase().trim()
        const dayMap: Record<string, string> = {
          montag: 'monday', dienstag: 'tuesday', mittwoch: 'wednesday',
          donnerstag: 'thursday', freitag: 'friday', samstag: 'saturday', sonntag: 'sunday',
          mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
          fri: 'friday', sat: 'saturday', sun: 'sunday',
        }
        wd = dayMap[wd] || wd
        const avail: LecturerAvailability = {
          lecturerId: String(row.lecturerId || '').trim(),
          weekday: wd as any,
          startTime: String(row.startTime || '08:00'),
          endTime: String(row.endTime || '12:00'),
        }
        if (row.weekId) avail.weekId = String(row.weekId).trim()
        return avail
      })
    },
  },

  scheduling_rules: {
    type: 'scheduling_rules',
    label: 'Scheduling Rules',
    icon: 'mdi-tune-vertical',
    description: 'Constraint rules for CP-SAT timetable generation.',
    entityName: 'Rule',
    fields: [
      {
        key: 'ruleType',
        label: 'Rule Type',
        required: true,
        type: 'enum',
        description: 'The scheduling constraint to apply',
        options: [
          'NO_TEACHER_OVERLAP', 'ROOM_CAPACITY', 'ROOM_OCCUPANCY', 'UNAVAILABLE_DATES',
          'ALLOWED_WEEKDAYS', 'ALLOWED_PHASE', 'FIXED_DAY', 'WEEKLY_BALANCE',
          'AVOID_FRIDAY_AFTERNOON', 'AVOID_SATURDAY', 'PREFER_MORNING',
          'AVOID_EVENING', 'MINIMIZE_STUDENT_GAPS', 'PREFER_EARLY_DATES',
        ],
        aliases: ['ruletype', 'rule_type', 'rule type', 'constraint_id', 'constraint', 'rule', 'regel', 'constraintid', 'rule_id'],
      },
      {
        key: 'semesterId',
        label: 'Semester ID',
        required: true,
        type: 'string',
        description: 'ID of the semester this rule applies to',
        aliases: ['semester_id', 'semester id', 'semester', 'semesterid'],
      },
      {
        key: 'category',
        label: 'Category',
        required: true,
        type: 'enum',
        description: 'hard (must satisfy) or soft (preference with penalty)',
        options: ['hard', 'soft'],
        aliases: ['category', 'kategorie', 'type', 'constraint_category'],
      },
      {
        key: 'weight',
        label: 'Priority Level',
        required: false,
        type: 'string',
        description: 'Priority for soft constraints: nice-to-have(1), preferred(5), desired(10), almost mandatory(20). Also accepts numeric values.',
        defaultValue: 1,
        aliases: ['weight', 'gewicht', 'penalty', 'priority', 'priority_level'],
      },
      {
        key: 'enabled',
        label: 'Enabled',
        required: false,
        type: 'boolean',
        description: 'Whether this rule is active (true/false)',
        defaultValue: true,
        aliases: ['enabled', 'active', 'aktiv', 'is_enabled'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Human-readable description of the rule',
        aliases: ['description', 'beschreibung', 'desc', 'text', 'note'],
      },
      {
        key: 'appliesTo',
        label: 'Applies To',
        required: false,
        type: 'string',
        description: 'Module IDs or names this rule applies to (comma-separated, empty = all)',
        aliases: ['applies_to', 'applies', 'targets', 'modules', 'module_ids', 'gilt_fuer'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): SchedulingRule[] => {
      const WEIGHT_MAP: Record<string, number> = {
        'nice-to-have': 1,
        'nice to have': 1,
        'preferred': 5,
        'desired': 10,
        'almost mandatory': 20,
        'almost-mandatory': 20,
      }
      return mappedRows.map(row => {
        let weight: number
        const rawWeight = String(row.weight ?? '1').trim().toLowerCase()
        if (WEIGHT_MAP[rawWeight] !== undefined) {
          weight = WEIGHT_MAP[rawWeight]
        } else {
          weight = Number(row.weight) || 1
        }
        const rule: SchedulingRule = {
          ruleType: String(row.ruleType || ''),
          semesterId: String(row.semesterId || ''),
          category: row.category === 'soft' ? 'soft' : 'hard',
          weight,
          enabled: parseBoolean(row.enabled ?? true),
          description: row.description ? String(row.description) : undefined,
          appliesTo: row.appliesTo ? parseStringArray(row.appliesTo) : undefined,
          params: undefined,
        }
        if (rule.category === 'hard') {
          rule.weight = 1
        }
        return rule
      })
    },
  },

  matrix_competencies: {
    type: 'matrix_competencies',
    label: 'Matrix Competencies',
    icon: 'mdi-view-grid',
    description: 'Competency matrix axes (x/y) for curriculum mapping.',
    entityName: 'Matrix Competency',
    fields: [
      {
        key: 'competencyMatrixId',
        label: 'Matrix ID',
        required: false,
        type: 'string',
        description: 'ID of the parent competency matrix',
        aliases: ['competencymatrixid', 'competency_matrix_id', 'matrix_id', 'matrixid', 'matrix'],
      },
      {
        key: 'name',
        label: 'Name',
        required: true,
        type: 'string',
        description: 'Name of the matrix competency axis',
        aliases: ['name', 'title', 'bezeichnung', 'kompetenz'],
      },
      {
        key: 'category',
        label: 'Category',
        required: false,
        type: 'string',
        description: 'Category of the competency',
        aliases: ['category', 'kategorie', 'area', 'group', 'type'],
      },
      {
        key: 'description',
        label: 'Description',
        required: false,
        type: 'string',
        description: 'Description of the matrix competency',
        aliases: ['description', 'beschreibung', 'details', 'desc'],
      },
      {
        key: 'level',
        label: 'Level',
        required: false,
        type: 'string',
        description: 'Competency level',
        aliases: ['level', 'niveau', 'stufe', 'kompetenzstufe'],
      },
      {
        key: 'matrixAxis',
        label: 'Matrix Axis',
        required: true,
        type: 'enum',
        description: 'Whether this competency defines the x-axis or y-axis',
        options: ['x', 'y'],
        defaultValue: 'x',
        aliases: ['matrixaxis', 'matrix_axis', 'axis', 'achse'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): MatrixCompetency[] => {
      return mappedRows.map(obj => {
        const mc: MatrixCompetency = {
          name: String(obj.name || 'Unnamed Matrix Competency'),
          matrixAxis: obj.matrixAxis === 'y' ? 'y' : 'x',
        }
        if (obj.competencyMatrixId) mc.competencyMatrixId = String(obj.competencyMatrixId)
        if (obj.category) mc.category = String(obj.category)
        if (obj.description) mc.description = String(obj.description)
        if (obj.level) mc.level = String(obj.level)
        return mc
      })
    },
  },

  room_availability: {
    type: 'room_availability',
    label: 'Room Availability',
    icon: 'mdi-calendar-clock-outline',
    description: 'Recurring weekly availability for rooms.',
    entityName: 'Room Availability',
    fields: [
      {
        key: 'roomId',
        label: 'Room ID',
        required: true,
        type: 'string',
        description: 'ID of the room',
        aliases: ['room_id', 'room id', 'room', 'roomid', 'raum', 'raum_id'],
      },
      {
        key: 'weekId',
        label: 'Week ID',
        required: false,
        type: 'string',
        description: 'ID of the week this availability slot applies to',
        aliases: ['week_id', 'week id', 'week', 'woche'],
      },
      {
        key: 'weekday',
        label: 'Weekday',
        required: true,
        type: 'enum',
        description: 'Day of the week for recurring availability',
        options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunnday',
          'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
        aliases: ['weekday', 'day', 'day_of_week', 'wochentag', 'tag'],
      },
      {
        key: 'startTime',
        label: 'Start Time',
        required: true,
        type: 'string',
        description: 'Start time of availability slot (HH:MM format)',
        aliases: ['start_time', 'start', 'von', 'begin', 'beginn'],
      },
      {
        key: 'endTime',
        label: 'End Time',
        required: true,
        type: 'string',
        description: 'End time of availability slot (HH:MM format)',
        aliases: ['end_time', 'end', 'bis', 'ende'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): RoomAvailability[] => {
      return mappedRows.map(row => {
        let wd = String(row.weekday || 'monday').toLowerCase().trim()
        const dayMap: Record<string, string> = {
          montag: 'monday', dienstag: 'tuesday', mittwoch: 'wednesday',
          donnerstag: 'thursday', freitag: 'friday', samstag: 'saturday', sonntag: 'sunday',
          mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
          fri: 'friday', sat: 'saturday', sun: 'sunday',
        }
        wd = dayMap[wd] || wd
        const avail: RoomAvailability = {
          roomId: String(row.roomId || '').trim(),
          weekday: wd as any,
          startTime: String(row.startTime || '08:00'),
          endTime: String(row.endTime || '12:00'),
        }
        if (row.weekId) avail.weekId = String(row.weekId).trim()
        return avail
      })
    },
  },

  weeks: {
    type: 'weeks',
    label: 'Weeks',
    icon: 'mdi-calendar-week',
    description: 'Calendar weeks within a semester, including days off.',
    entityName: 'Week',
    fields: [
      {
        key: 'semesterId',
        label: 'Semester ID',
        required: true,
        type: 'string',
        description: 'ID of the semester this week belongs to',
        aliases: ['semester_id', 'semester id', 'semester', 'semesterid'],
      },
      {
        key: 'semesterWeek',
        label: 'Semester Week',
        required: true,
        type: 'number',
        description: 'Week number within the semester (1-based)',
        aliases: ['semesterweek', 'semester_week', 'semester week', 'week_number', 'woche', 'kalenderwoche'],
      },
      {
        key: 'startDate',
        label: 'Start Date',
        required: true,
        type: 'string',
        description: 'First day of the week (YYYY-MM-DD)',
        aliases: ['start_date', 'start date', 'start', 'beginn', 'von'],
      },
      {
        key: 'endDate',
        label: 'End Date',
        required: true,
        type: 'string',
        description: 'Last day of the week (YYYY-MM-DD)',
        aliases: ['end_date', 'end date', 'end', 'ende', 'bis'],
      },
      {
        key: 'daysOff',
        label: 'Days Off',
        required: false,
        type: 'string',
        description: 'Dates without teaching (comma-separated YYYY-MM-DD)',
        aliases: ['daysoff', 'days_off', 'days off', 'holidays', 'feiertage', 'freie_tage'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): Week[] => {
      return mappedRows.map(row => {
        const week: Week = {
          semesterId: String(row.semesterId || '').trim(),
          semesterWeek: Number(row.semesterWeek) || 1,
          startDate: String(row.startDate || '').trim(),
          endDate: String(row.endDate || '').trim(),
        }
        const daysOff = parseStringArray(row.daysOff)
        if (daysOff.length > 0) week.daysOff = daysOff
        if (row.id) week.id = String(row.id)
        return week
      })
    },
  },

  schedule_entries: {
    type: 'schedule_entries',
    label: 'Schedule Entries',
    icon: 'mdi-calendar-clock-outline',
    description: 'Scheduled sessions within a week: modules, rooms, classes, lecturers, weekday and time window.',
    entityName: 'Schedule Entry',
    fields: [
      {
        key: 'weekId',
        label: 'Week ID',
        required: true,
        type: 'string',
        description: 'ID of the week this entry belongs to',
        aliases: ['week_id', 'week id', 'week', 'woche'],
      },
      {
        key: 'moduleIds',
        label: 'Module IDs',
        required: false,
        type: 'string',
        description: 'Module IDs (comma, semicolon, or pipe separated)',
        aliases: ['moduleids', 'module_ids', 'module ids', 'modules', 'modul', 'modul_ids'],
      },
      {
        key: 'roomIds',
        label: 'Room IDs',
        required: false,
        type: 'string',
        description: 'Room IDs (comma, semicolon, or pipe separated)',
        aliases: ['roomids', 'room_ids', 'room ids', 'rooms', 'raum', 'raum_ids'],
      },
      {
        key: 'classIds',
        label: 'Class IDs',
        required: false,
        type: 'string',
        description: 'Class IDs (comma, semicolon, or pipe separated)',
        aliases: ['classids', 'class_ids', 'class ids', 'classes', 'klasse', 'klassen'],
      },
      {
        key: 'lecturerIds',
        label: 'Lecturer IDs',
        required: false,
        type: 'string',
        description: 'Lecturer IDs (comma, semicolon, or pipe separated)',
        aliases: ['lecturerids', 'lecturer_ids', 'lecturer ids', 'lecturers', 'dozent', 'dozenten'],
      },
      {
        key: 'weekday',
        label: 'Weekday',
        required: true,
        type: 'enum',
        description: 'Day of the week for the session',
        options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
          'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
        aliases: ['weekday', 'day', 'day_of_week', 'wochentag', 'tag'],
      },
      {
        key: 'startTime',
        label: 'Start Time',
        required: true,
        type: 'string',
        description: 'Start time (HH:MM format)',
        aliases: ['start_time', 'start', 'von', 'begin', 'beginn'],
      },
      {
        key: 'endTime',
        label: 'End Time',
        required: true,
        type: 'string',
        description: 'End time (HH:MM format)',
        aliases: ['end_time', 'end', 'bis', 'ende'],
      },
    ],
    transform: (mappedRows: Record<string, any>[]): ScheduleEntry[] => {
      return mappedRows.map(row => {
        let wd = String(row.weekday || 'monday').toLowerCase().trim()
        const dayMap: Record<string, string> = {
          montag: 'monday', dienstag: 'tuesday', mittwoch: 'wednesday',
          donnerstag: 'thursday', freitag: 'friday', samstag: 'saturday', sonntag: 'sunday',
          mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
          fri: 'friday', sat: 'saturday', sun: 'sunday',
        }
        wd = dayMap[wd] || wd
        const entry: ScheduleEntry = {
          weekId: String(row.weekId || '').trim(),
          moduleIds: parseStringArray(row.moduleIds),
          roomIds: parseStringArray(row.roomIds),
          classIds: parseStringArray(row.classIds),
          lecturerIds: parseStringArray(row.lecturerIds),
          weekday: wd as any,
          startTime: String(row.startTime || '08:00'),
          endTime: String(row.endTime || '12:00'),
        }
        if (row.id) entry.id = String(row.id)
        return entry
      })
    },
  },
}

function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val
  if (!val) return false
  const s = String(val).toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'ja' || s === 't'
}
