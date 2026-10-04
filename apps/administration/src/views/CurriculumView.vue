<template>
  <v-container>
    <h1 class="mb-1">Curriculum</h1>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Manage departments, programs, degrees, modules, classes, and semesters across the curriculum.
    </p>

    <v-tabs v-model="activeTab">
      <v-tab value="curriculum">
        <v-icon start>mdi-source-branch</v-icon>
        Curriculum
      </v-tab>
      <v-tab value="departments">Departments</v-tab>
      <v-tab value="semesters">Semesters</v-tab>
    </v-tabs>

    <v-window v-model="activeTab" class="mt-4">
      <v-window-item value="departments">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddDepartment">Add Department</v-btn>
            <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('departments')">Import CSV</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="deptSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search departments"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="deptHeaders"
          :items="filteredDepartments"
          :sort-by="deptSortBy"
          @update:sort-by="deptSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.description="{ item }">
            {{ item.description || '-' }}
          </template>
          <template #item.contact="{ item }">
            {{ item.contact || '-' }}
          </template>
          <template #item.url="{ item }">
            <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
              {{ item.url || item.URL }}
            </a>
            <span v-else class="text-medium-emphasis">-</span>
          </template>
          <template #item.name="{ item }">
            <span>{{ item.name }}</span>
            <v-chip v-if="item._isAdmin" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
            <v-chip v-else-if="item._canEdit" size="x-small" variant="tonal" color="secondary" class="ml-1">Write</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditDepartment(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn v-if="item._isAdmin" icon variant="text" size="small" @click="confirmDeleteDepartment(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <v-btn icon variant="text" size="small" @click="openRestrictions(item, 'departments')">
              <v-icon>mdi-shield-lock-outline</v-icon>
              <v-tooltip activator="parent">Restrictions</v-tooltip>
            </v-btn>
            <v-btn icon variant="text" size="small" @click="openAccess(item, 'departments')">
              <v-icon>mdi-account-multiple-outline</v-icon>
              <v-tooltip activator="parent">Access</v-tooltip>
            </v-btn>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-domain</v-icon>
              <p class="mt-2 text-medium-emphasis">No departments found.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <v-window-item value="semesters">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddSemester">Add Semester</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="semSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search semesters"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="semHeaders"
          :items="filteredSemesters"
          :sort-by="semSortBy"
          @update:sort-by="semSortBy = $event"
          hover
          items-per-page="15"
        >
          <template #item.name="{ item }">
            <span class="font-weight-medium">{{ item.name || item.code }}</span>
          </template>
          <template #item.code="{ item }">
            {{ item.code || '—' }}
          </template>
          <template #item.startDate="{ item }">
            {{ formatDate(item.startDate) }}
          </template>
          <template #item.endDate="{ item }">
            {{ formatDate(item.endDate) }}
          </template>
          <template #item.slotStartTimes="{ item }">
            <span v-if="item.slotDurationMinutes && item.slotStartTimes && item.slotStartTimes.length > 0">
              <v-tooltip activator="parent" location="top">
                {{ item.slotStartTimes.join(', ') }}
              </v-tooltip>
              {{ item.slotDurationMinutes }} min · {{ item.slotStartTimes.length }} starts
            </span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>
          <template #item.actions="{ item }">
            <template v-if="auth.isAdmin">
              <v-btn icon variant="text" size="small" @click="openEditSemester(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteSemester(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-school-outline</v-icon>
              <p class="mt-2 text-medium-emphasis">No semesters found.</p>
              <p class="text-caption text-medium-emphasis">Add a semester to define scheduling periods.</p>
            </div>
          </template>
        </v-data-table>
      </v-window-item>

      <v-window-item value="curriculum">
        <v-row class="align-center mb-4">
          <v-col cols="12" sm="6" class="d-flex ga-2">
            <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddCurriculum">New Curriculum</v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="currSearch"
              prepend-inner-icon="mdi-magnify"
              label="Search curriculums"
              single-line
              hide-details
              clearable
              density="compact"
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="currHeaders"
          :items="filteredCurriculums"
          :sort-by="currSortBy"
          @update:sort-by="currSortBy = $event"
          hover
          items-per-page="15"
          show-expand
        >
          <template #item.name="{ item }">
            <span class="font-weight-medium">{{ item.name }}</span>
            <v-chip v-if="item._isAdmin" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
            <v-chip v-else-if="item._canEdit" size="x-small" variant="tonal" color="secondary" class="ml-1">Write</v-chip>
          </template>
          <template #item.versionCount="{ item }">
            {{ getVersionsOfCurriculum(item).length }}
          </template>
          <template #item.activeVersion="{ item }">
            <span v-if="getActiveVersion(item)">V{{ getActiveVersion(item)!.versionNumber }}</span>
            <span v-else class="text-medium-emphasis">—</span>
          </template>
          <template #item.programCount="{ item }">
            {{ getProgramCount(item) }}
          </template>
          <template #item.moduleCount="{ item }">
            {{ getModuleCount(item) }}
          </template>
          <template #item.actions="{ item }">
            <template v-if="auth.isAdmin">
              <v-btn icon variant="text" size="small" @click="addVersionToCurriculum(item)">
                <v-icon>mdi-source-branch</v-icon>
                <v-tooltip activator="parent">Add Version</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="openEditCurriculum(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteCurriculum(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <v-btn icon variant="text" size="small" @click="openRestrictions(item, 'curriculums')">
              <v-icon>mdi-shield-lock-outline</v-icon>
              <v-tooltip activator="parent">Restrictions</v-tooltip>
            </v-btn>
            <v-btn icon variant="text" size="small" @click="openAccess(item, 'curriculums')">
              <v-icon>mdi-account-multiple-outline</v-icon>
              <v-tooltip activator="parent">Access</v-tooltip>
            </v-btn>
          </template>
          <template #no-data>
            <div class="text-center pa-4">
              <v-icon size="64" color="grey-lighten-1">mdi-book-education</v-icon>
              <p class="mt-2 text-medium-emphasis">No curriculums found.</p>
              <p class="text-caption text-medium-emphasis">Create a new curriculum to get started.</p>
            </div>
          </template>
          <template #expanded-row="{ item }">
            <tr>
              <td :colspan="currHeaders.length" class="pa-0">
                <CurriculumVersionTable
                  :versions="getVersionsOfCurriculum(item)"
                  :active-version-id="item.activeVersionId"
                  :can-edit="auth.isAdmin"
                  :semesters="semesterList"
                  @add-version="addVersionToCurriculum(item)"
                  @manage="manageVersion"
                  @set-active="setActiveVersion(item, $event)"
                  @edit="openEditVersion"
                  @delete="confirmDeleteVersion"
                />
              </td>
            </tr>
          </template>
        </v-data-table>

        <v-alert
          v-if="curriculumSelectItems.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-4"
          text="Create a new curriculum above to manage its programs, degrees, modules and classes."
        />

        <div ref="contentSectionRef">
          <v-row v-if="curriculumSelectItems.length > 0" class="align-center mt-2 mb-2">
            <v-col cols="12" sm="6">
              <v-select
                v-model="displayedCurriculumId"
                :items="curriculumSelectItems"
                label="Displayed curriculum"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-source-branch"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="displayedVersionId"
                :items="displayedVersionItems"
                label="Displayed curriculum version"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-tag-outline"
              />
            </v-col>
          </v-row>

          <v-tabs v-if="displayedCurriculumId" v-model="curriculumTab" bg-color="transparent" color="primary" class="mt-4">
            <v-tab value="programs">Programs</v-tab>
            <v-tab value="degrees">Degrees</v-tab>
            <v-tab value="modules">Modules</v-tab>
            <v-tab value="classes">Classes</v-tab>
          </v-tabs>
        </div>

        <div v-if="displayedCurriculumId && curriculumTab === 'programs'" class="mt-4">
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddProgram">Add Program</v-btn>
              <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('programs')">Import CSV</v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="progSearch"
                prepend-inner-icon="mdi-magnify"
                label="Search programs"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="progHeaders"
            :items="filteredPrograms"
            :sort-by="progSortBy"
            @update:sort-by="progSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.departmentIDs="{ item }">
              <template v-if="getDepartmentNames(item).length">
                <v-chip v-for="name in getDepartmentNames(item)" :key="name" size="x-small" variant="tonal" color="primary" class="mr-1">
                  {{ name }}
                </v-chip>
              </template>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.description="{ item }">
              {{ item.description || '-' }}
            </template>
            <template #item.contact="{ item }">
              {{ item.contact || '-' }}
            </template>
            <template #item.url="{ item }">
              <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
                {{ item.url || item.URL }}
              </a>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.name="{ item }">
              <span>{{ item.name }}</span>
              <v-chip v-if="item._isAdmin" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              <v-chip v-else-if="item._canEdit" size="x-small" variant="tonal" color="secondary" class="ml-1">Write</v-chip>
            </template>
            <template #item.actions="{ item }">
              <template v-if="item._canEdit">
                <v-btn icon variant="text" size="small" @click="openEditProgram(item)">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent">Edit</v-tooltip>
                </v-btn>
                <v-btn v-if="item._isAdmin" icon variant="text" size="small" @click="confirmDeleteProgram(item)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent">Delete</v-tooltip>
                </v-btn>
              </template>
              <v-btn icon variant="text" size="small" @click="openRestrictions(item, 'programs')">
                <v-icon>mdi-shield-lock-outline</v-icon>
                <v-tooltip activator="parent">Restrictions</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="openAccess(item, 'programs')">
                <v-icon>mdi-account-multiple-outline</v-icon>
                <v-tooltip activator="parent">Access</v-tooltip>
              </v-btn>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-school-outline</v-icon>
                <p class="mt-2 text-medium-emphasis">No programs found.</p>
              </div>
            </template>
          </v-data-table>
        </div>

        <div v-if="displayedCurriculumId && curriculumTab === 'degrees'" class="mt-4">
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn v-if="canCreateDegrees" color="primary" prepend-icon="mdi-plus" @click="openAddDegree">Add Degree</v-btn>
              <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('degrees')">Import CSV</v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="degSearch"
                prepend-inner-icon="mdi-magnify"
                label="Search degrees"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="degHeaders"
            :items="filteredDegrees"
            :sort-by="degSortBy"
            @update:sort-by="degSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.ProgramIDs="{ item }">
              <template v-if="getProgramNames(item).length">
                <v-chip v-for="name in getProgramNames(item)" :key="name" size="x-small" variant="tonal" color="secondary" class="mr-1">
                  {{ name }}
                </v-chip>
              </template>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.description="{ item }">
              {{ item.description || '-' }}
            </template>
            <template #item.contact="{ item }">
              {{ item.contact || '-' }}
            </template>
            <template #item.url="{ item }">
              <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
                {{ item.url || item.URL }}
              </a>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.name="{ item }">
              <span>{{ item.name }}</span>
              <v-chip v-if="item._isAdmin" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              <v-chip v-else-if="item._canEdit" size="x-small" variant="tonal" color="secondary" class="ml-1">Write</v-chip>
            </template>
            <template #item.actions="{ item }">
              <template v-if="item._canEdit">
                <v-btn icon variant="text" size="small" @click="openEditDegree(item)">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent">Edit</v-tooltip>
                </v-btn>
                <v-btn v-if="item._isAdmin" icon variant="text" size="small" @click="confirmDeleteDegree(item)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent">Delete</v-tooltip>
                </v-btn>
              </template>
              <v-btn icon variant="text" size="small" @click="openRestrictions(item, 'degrees')">
                <v-icon>mdi-shield-lock-outline</v-icon>
                <v-tooltip activator="parent">Restrictions</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="openAccess(item, 'degrees')">
                <v-icon>mdi-account-multiple-outline</v-icon>
                <v-tooltip activator="parent">Access</v-tooltip>
              </v-btn>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-certificate-outline</v-icon>
                <p class="mt-2 text-medium-emphasis">No degrees found.</p>
              </div>
            </template>
          </v-data-table>
        </div>

        <div v-if="displayedCurriculumId && curriculumTab === 'modules'" class="mt-4">
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn v-if="canCreateModules" color="primary" prepend-icon="mdi-plus" @click="openAddModule">Add Module</v-btn>
              <v-btn v-if="auth.isAdmin" variant="outlined" prepend-icon="mdi-file-import" @click="openCsvImport('modules')">Import CSV</v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="modSearch"
                prepend-inner-icon="mdi-magnify"
                label="Search modules"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="modHeaders"
            :items="filteredModules"
            :sort-by="modSortBy"
            @update:sort-by="modSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.code="{ item }">
              {{ item.code || '-' }}
            </template>
            <template #item.DegreeIDs="{ item }">
              <template v-if="getDegreeNames(item).length">
                <v-chip v-for="name in getDegreeNames(item)" :key="name" size="x-small" variant="tonal" color="teal" class="mr-1">
                  {{ name }}
                </v-chip>
              </template>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.creditPoints="{ item }">
              {{ item.creditPoints ?? '—' }}
            </template>
            <template #item.timeslots="{ item }">
              <span v-if="item.timeslots != null && displayedSemesterTimeslots" class="text-medium-emphasis">
                {{ item.timeslots }} × {{ displayedSemesterTimeslots.duration }} min
              </span>
              <span v-else-if="item.timeslots != null">{{ item.timeslots }}</span>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.name="{ item }">
              <span>{{ item.name }}</span>
              <v-chip v-if="item._isAdmin" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              <v-chip v-else-if="item._canEdit" size="x-small" variant="tonal" color="secondary" class="ml-1">Write</v-chip>
            </template>
            <template #item.actions="{ item }">
              <template v-if="item._canEdit">
                <v-btn icon variant="text" size="small" @click="openEditModule(item)">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent">Edit</v-tooltip>
                </v-btn>
                <v-btn v-if="item._isAdmin" icon variant="text" size="small" @click="confirmDeleteModule(item)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent">Delete</v-tooltip>
                </v-btn>
              </template>
              <v-btn icon variant="text" size="small" @click="openRestrictions(item, 'modules')">
                <v-icon>mdi-shield-lock-outline</v-icon>
                <v-tooltip activator="parent">Restrictions</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="openAccess(item, 'modules')">
                <v-icon>mdi-account-multiple-outline</v-icon>
                <v-tooltip activator="parent">Access</v-tooltip>
              </v-btn>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-book-open-page-variant</v-icon>
                <p class="mt-2 text-medium-emphasis">No modules found.</p>
              </div>
            </template>
          </v-data-table>
        </div>

        <div v-if="displayedCurriculumId && curriculumTab === 'classes'" class="mt-4">
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddClass">Add Class</v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="clsSearch"
                prepend-inner-icon="mdi-magnify"
                label="Search classes"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="clsHeaders"
            :items="filteredClasses"
            :sort-by="clsSortBy"
            @update:sort-by="clsSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.code="{ item }">
              {{ item.code || '-' }}
            </template>
            <template #item.degreeId="{ item }">
              {{ getDegreeName(item.degreeId) }}
            </template>
            <template #item.size="{ item }">
              {{ item.size ?? '-' }}
            </template>
            <template #item.programIds="{ item }">
              <template v-if="getClassProgramNames(item).length">
                <v-chip v-for="name in getClassProgramNames(item)" :key="name" size="x-small" variant="tonal" color="secondary" class="mr-1">
                  {{ name }}
                </v-chip>
              </template>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.semesterId="{ item }">
              {{ getSemesterName(item.semesterId) || '-' }}
            </template>
            <template #item.description="{ item }">
              {{ item.description || '-' }}
            </template>
            <template #item.contact="{ item }">
              {{ item.contact || '-' }}
            </template>
            <template #item.url="{ item }">
              <a v-if="item.url || item.URL" :href="item.url || item.URL" target="_blank" rel="noopener" class="text-decoration-none">
                {{ item.url || item.URL }}
              </a>
              <span v-else class="text-medium-emphasis">-</span>
            </template>
            <template #item.name="{ item }">
              <span>{{ item.name }}</span>
              <v-chip v-if="item._isAdmin" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              <v-chip v-else-if="item._canEdit" size="x-small" variant="tonal" color="secondary" class="ml-1">Write</v-chip>
            </template>
            <template #item.actions="{ item }">
              <template v-if="item._canEdit">
                <v-btn icon variant="text" size="small" @click="openEditClass(item)">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent">Edit</v-tooltip>
                </v-btn>
                <v-btn v-if="item._isAdmin" icon variant="text" size="small" @click="confirmDeleteClass(item)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent">Delete</v-tooltip>
                </v-btn>
              </template>
              <v-btn icon variant="text" size="small" @click="openRestrictions(item, 'classes')">
                <v-icon>mdi-shield-lock-outline</v-icon>
                <v-tooltip activator="parent">Restrictions</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="openAccess(item, 'classes')">
                <v-icon>mdi-account-multiple-outline</v-icon>
                <v-tooltip activator="parent">Access</v-tooltip>
              </v-btn>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-account-group</v-icon>
                <p class="mt-2 text-medium-emphasis">No classes found.</p>
              </div>
            </template>
          </v-data-table>
        </div>
      </v-window-item>
    </v-window>

    <DepartmentFormDialog
      v-model="deptDialogOpen"
      :department-data="editDepartment"
      @save="handleDepartmentSave"
    />

    <ProgramFormDialog
      v-model="progDialogOpen"
      :program-data="editProgram"
      :departments="departments"
      :curriculums="curriculumSelectItems"
      @save="handleProgramSave"
    />

    <DegreeFormDialog
      v-model="degDialogOpen"
      :degree-data="editDegree"
      :programs="programsOfDisplayedVersion"
      @save="handleDegreeSave"
    />

    <ModuleFormDialog
      v-model="modDialogOpen"
      :module-data="editModule"
      :degrees="degreesOfDisplayedVersion"
      :classes="classes"
      :curriculum-versions="displayedVersionItems"
      :semester-timeslots="displayedSemesterTimeslots"
      @save="handleModuleSave"
    />

    <ClassFormDialog
      v-model="clsDialogOpen"
      :class-data="editClass"
      :programs="programsOfDisplayedVersion"
      :degrees="degreesOfDisplayedVersion"
      :semesters="semesterList"
      :curriculum-versions="displayedVersionItems"
      @save="handleClassSave"
    />

    <SemesterFormDialog
      v-model="semDialogOpen"
      :semester-data="editSemester"
      @save="handleSemesterSave"
    />

    <CurriculumFormDialog
      v-model="currDialogOpen"
      :curriculum-data="editCurriculum"
      @save="handleCurriculumSave"
    />

    <CurriculumVersionFormDialog
      v-model="verDialogOpen"
      :version-data="editVersion"
      :semesters="semesterList"
      @save="handleVersionSave"
    />

    <AccessDialog
      v-model="accessDialogOpen"
      :entity="accessEntity"
      :entity-id="accessEntityId"
      :entity-name="accessEntityName"
      @changed="handleAccessChanged"
    />

    <RestrictionsDialog
      v-model="restrictionsDialogOpen"
      :owner="restrictionsOwner"
    />

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      :initial-type="csvImportType"
      :curriculum-context="{ curriculumId: displayedCurriculumId, curriculumVersionId: displayedVersionId }"
      @imported="handleCsvImported"
    />

    <v-dialog v-model="deleteDialogOpen" max-width="420">
      <v-card>
        <v-card-title>Confirm deletion</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deleteTargetName }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="handleDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useDepartments } from '@/composables/useDepartments'
import { usePrograms } from '@/composables/usePrograms'
import { useDegrees } from '@/composables/useDegrees'
import { useModules } from '@/composables/useModules'
import { useSemesters } from '@/composables/useSemesters'
import { useClasses } from '@/composables/useClasses'
import { useAuthStore } from '@/stores/auth'
import DepartmentFormDialog from '@/components/DepartmentFormDialog.vue'
import ProgramFormDialog from '@/components/ProgramFormDialog.vue'
import DegreeFormDialog from '@/components/DegreeFormDialog.vue'
import ModuleFormDialog from '@/components/ModuleFormDialog.vue'
import ClassFormDialog from '@/components/ClassFormDialog.vue'
import SemesterFormDialog from '@/components/SemesterFormDialog.vue'
import CurriculumFormDialog from '@/components/CurriculumFormDialog.vue'
import CurriculumVersionFormDialog from '@/components/CurriculumVersionFormDialog.vue'
import CurriculumVersionTable from '@/components/CurriculumVersionTable.vue'
import AccessDialog from '@/components/AccessDialog.vue'
import RestrictionsDialog from '@/components/RestrictionsDialog.vue'
import type { RestrictionsOwner } from '@/composables/useRestrictions'
import { useCurriculums, useCurriculumVersions } from '@/composables/useCurriculumVersions'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { Curriculum, Department, Program, Degree, Module } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'
import type { Semester, CurriculumVersion } from '@/stores/curriculum'
import type { ImportType } from '@/types/csvImport'

const auth = useAuthStore()

const canCreateDegrees = computed(() => auth.isAdmin || programs.value.some(p => p._isAdmin))
const canCreateModules = computed(() => auth.isAdmin || degrees.value.some(d => d._isAdmin))

const {
  departments,
  fetchDepartments,
  addDepartment,
  updateDepartment,
  removeDepartment,
} = useDepartments()

const {
  programs,
  fetchPrograms,
  addProgram,
  updateProgram,
  removeProgram,
} = usePrograms()

const {
  degrees,
  fetchDegrees,
  addDegree,
  updateDegree,
  removeDegree,
} = useDegrees()

const {
  modules,
  fetchModules,
  addModule,
  updateModule,
  removeModule,
} = useModules()

const {
  classes,
  fetchClasses,
  addClass,
  updateClass,
  removeClass,
} = useClasses()

const {
  semesters: semesterList,
  fetchSemesters,
  addSemester,
  updateSemester,
  removeSemester,
} = useSemesters()

const {
  curriculums,
  fetchCurriculums,
  createCurriculumWithV1,
  addVersionToCurriculum: addVersionToCurriculumApi,
  setActiveVersion: setActiveVersionApi,
  updateCurriculum,
  removeCurriculum,
} = useCurriculums()

const {
  curriculumVersions,
  fetchCurriculumVersions,
  updateCurriculumVersion,
  removeCurriculumVersion,
} = useCurriculumVersions()

const activeTab = ref<'curriculum' | 'departments' | 'semesters'>('curriculum')
const curriculumTab = ref<'programs' | 'degrees' | 'modules' | 'classes'>('programs')

const deptSearch = ref('')
const deptDialogOpen = ref(false)
const editDepartment = ref<Department | undefined>(undefined)
const deptSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const progSearch = ref('')
const progDialogOpen = ref(false)
const editProgram = ref<Program | undefined>(undefined)
const progSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const degSearch = ref('')
const degDialogOpen = ref(false)
const editDegree = ref<Degree | undefined>(undefined)
const degSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const modSearch = ref('')
const modDialogOpen = ref(false)
const editModule = ref<Module | undefined>(undefined)
const modSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const clsSearch = ref('')
const clsDialogOpen = ref(false)
const editClass = ref<ClassEntity | undefined>(undefined)
const clsSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

const semSearch = ref('')
const semDialogOpen = ref(false)
const editSemester = ref<Semester | null>(null)
const semSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'startDate', order: 'desc' }])

const currSearch = ref('')
const currDialogOpen = ref(false)
const editCurriculum = ref<Curriculum | null>(null)
const currSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([])

// The curriculum whose program/degree/module/class lists are shown below the
// curriculum table. Programs always belong to this curriculum; modules and
// classes additionally belong to the displayed curriculum version.
const displayedCurriculumId = ref('')
const displayedVersionId = ref('')
const contentSectionRef = ref<HTMLElement | null>(null)

const verDialogOpen = ref(false)
const editVersion = ref<CurriculumVersion | null>(null)

const csvImportDialogOpen = ref(false)
const csvImportType = ref<ImportType>('departments')

const accessDialogOpen = ref(false)
const accessEntity = ref<'departments' | 'programs' | 'degrees' | 'modules' | 'classes' | 'curriculums'>('programs')
const accessEntityId = ref('')
const accessEntityName = ref('')

const restrictionsDialogOpen = ref(false)
const restrictionsOwner = ref<RestrictionsOwner | null>(null)

function openRestrictions(
  item: { id?: string; _id?: string; name?: string; _canEdit?: boolean },
  entity: 'departments' | 'programs' | 'degrees' | 'modules' | 'classes' | 'curriculums',
) {
  const id = item.id || item._id || ''
  if (!id) return
  restrictionsOwner.value = { table: entity, id, name: item.name ?? '', _canEdit: item._canEdit }
  restrictionsDialogOpen.value = true
}

function openAccess(item: { id?: string; _id?: string; name?: string }, entity: typeof accessEntity.value) {
  const id = item.id || item._id || ''
  if (!id) return
  accessEntity.value = entity
  accessEntityId.value = id
  accessEntityName.value = item.name ?? ''
  accessDialogOpen.value = true
}

async function handleAccessChanged() {
  if (accessEntity.value === 'departments') await fetchDepartments()
  else if (accessEntity.value === 'programs') await fetchPrograms()
  else if (accessEntity.value === 'degrees') await fetchDegrees()
  else if (accessEntity.value === 'modules') await fetchModules()
  else if (accessEntity.value === 'curriculums') await fetchCurriculums()
  else await fetchClasses()
}

const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
let deleteKind: 'curriculum' | 'department' | 'program' | 'degree' | 'module' | 'class' | 'semester' | 'version' = 'department'
let deleteId = ''

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const deptHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

const progHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Departments', key: 'departmentIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

const degHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Programs', key: 'ProgramIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

const modHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Degrees', key: 'DegreeIDs', sortable: false },
  { title: 'ECTS', key: 'creditPoints', sortable: true },
  { title: 'Timeslots', key: 'timeslots', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

const clsHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Programs', key: 'programIds', sortable: false },
  { title: 'Degree', key: 'degreeId', sortable: false },
  { title: 'Size', key: 'size', sortable: true },
  { title: 'Semester', key: 'semesterId', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

const semHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Start', key: 'startDate', sortable: true },
  { title: 'End', key: 'endDate', sortable: true },
  { title: 'Timeslots', key: 'slotStartTimes', sortable: false },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

const currHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Versions', key: 'versionCount', sortable: true },
  { title: 'Active', key: 'activeVersion', sortable: false },
  { title: 'Programs', key: 'programCount', sortable: true },
  { title: 'Modules', key: 'moduleCount', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '150px' },
]

function getDepartmentNames(prog: Program): string[] {
  const ids = prog.departmentIDs ?? prog.departmentIds ?? []
  return ids.map(id => {
    const dept = departments.value.find(d => d.id === id)
    return dept ? dept.name : id
  })
}

function getProgramNames(deg: Degree): string[] {
  const ids = deg.ProgramIDs ?? deg.programIDs ?? deg.programIds ?? []
  return ids.map(id => {
    const prog = programs.value.find(p => p.id === id)
    return prog ? prog.name : id
  })
}

function getDegreeNames(mod: Module): string[] {
  const ids = mod.DegreeIDs ?? mod.degreeIDs ?? mod.degreeIds ?? []
  return ids.map(id => {
    const deg = degrees.value.find(d => d.id === id)
    return deg ? deg.name : id
  })
}

function getDegreeName(degreeId: string | undefined): string {
  if (!degreeId) return '-'
  const deg = degrees.value.find(d => d.id === degreeId)
  return deg ? (deg.name || degreeId) : degreeId
}

function getClassProgramNames(cls: ClassEntity): string[] {
  const ids = cls.programIds ?? []
  return ids.map((id: string) => {
    const prog = programs.value.find(p => p.id === id)
    return prog ? prog.name : id
  })
}

function getSemesterName(semesterId: string | undefined): string {
  if (!semesterId) return ''
  const sem = semesterList.value.find(s => (s._id || s.id) === semesterId)
  return sem ? (sem.name ?? sem.code ?? '') : semesterId
}

const filteredDepartments = computed(() => {
  if (!deptSearch.value) return departments.value
  const q = deptSearch.value.toLowerCase()
  return departments.value.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description ?? '').toLowerCase().includes(q) ||
    (d.contact ?? '').toLowerCase().includes(q)
  )
})

// Entities belong to the displayed curriculum (programs), its programs
// (degrees) or its displayed version (modules, classes). The search filters
// below apply on top of this scope.
const filteredPrograms = computed(() => {
  const scoped = programs.value.filter(p => displayedCurriculumId.value && p.curriculumId === displayedCurriculumId.value)
  if (!progSearch.value) return scoped
  const q = progSearch.value.toLowerCase()
  return scoped.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.description ?? '').toLowerCase().includes(q) ||
    (p.contact ?? '').toLowerCase().includes(q) ||
    getDepartmentNames(p).some(n => n.toLowerCase().includes(q))
  )
})

const displayedCurriculum = computed(() =>
  curriculums.value.find(c => (c._id || c.id) === displayedCurriculumId.value)
)

const displayedCurriculumVersions = computed(() => {
  const curr = displayedCurriculum.value
  return curr ? getVersionsOfCurriculum(curr) : []
})

const displayedVersion = computed(() =>
  curriculumVersions.value.find(v => (v._id || v.id) === displayedVersionId.value)
)

const curriculumSelectItems = computed(() =>
  curriculums.value.map(c => ({
    title: c.name,
    value: c._id || c.id || '',
  })).filter(i => i.value)
)

const displayedVersionItems = computed(() =>
  displayedCurriculumVersions.value.map(v => ({
    title: `V${v.versionNumber} — ${v.name || 'Version'}`,
    value: v._id || v.id || '',
  })).filter(i => i.value)
)

// Keep the displayed version valid whenever curriculum or version data changes.
watch([displayedCurriculumId, curriculumVersions, displayedCurriculumVersions], () => {
  const ids = new Set(displayedCurriculumVersions.value.map(v => v._id || v.id || ''))
  if (!displayedVersionId.value || !ids.has(displayedVersionId.value)) {
    displayedVersionId.value = displayedCurriculum.value?.activeVersionId || ''
  }
}, { immediate: true })

const programsOfDisplayedVersion = computed(() =>
  programs.value.filter(p => displayedCurriculumId.value && p.curriculumId === displayedCurriculumId.value)
)

const degreesOfDisplayedVersion = computed(() =>
  degrees.value.filter(d =>
    (d.ProgramIDs ?? d.programIDs ?? d.programIds ?? [])
      .some(pid => programsOfDisplayedVersion.value.some(p => p.id === pid))
  )
)

const displayedSemesterTimeslots = computed(() => {
  const sem = semesterList.value.find(s => (s._id || s.id) === displayedVersion.value?.semesterId)
  if (!sem?.slotDurationMinutes) return null
  return { duration: sem.slotDurationMinutes, startTimes: sem.slotStartTimes ?? [] }
})

// A degree belongs to the displayed curriculum when at least one of its
// programs does.
const filteredDegrees = computed(() => {
  const scoped = degrees.value.filter(d =>
    (d.ProgramIDs ?? d.programIDs ?? d.programIds ?? [])
      .some(pid => filteredPrograms.value.some(p => p.id === pid))
  )
  if (!degSearch.value) return scoped
  const q = degSearch.value.toLowerCase()
  return scoped.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description ?? '').toLowerCase().includes(q) ||
    (d.contact ?? '').toLowerCase().includes(q) ||
    getProgramNames(d).some(n => n.toLowerCase().includes(q))
  )
})

const filteredModules = computed(() => {
  const scoped = modules.value.filter(m => displayedVersionId.value && m.curriculumVersionId === displayedVersionId.value)
  if (!modSearch.value) return scoped
  const q = modSearch.value.toLowerCase()
  return scoped.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.code ?? '').toLowerCase().includes(q) ||
    (m.description ?? '').toLowerCase().includes(q) ||
    (m.contact ?? '').toLowerCase().includes(q) ||
    getDegreeNames(m).some(n => n.toLowerCase().includes(q))
  )
})

const filteredClasses = computed(() => {
  const scoped = classes.value.filter(c => displayedVersionId.value && c.curriculumVersionId === displayedVersionId.value)
  if (!clsSearch.value) return scoped
  const q = clsSearch.value.toLowerCase()
  return scoped.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.code ?? '').toLowerCase().includes(q) ||
    (c.description ?? '').toLowerCase().includes(q) ||
    (c.contact ?? '').toLowerCase().includes(q) ||
    getClassProgramNames(c).some(n => n.toLowerCase().includes(q))
  )
})

const filteredSemesters = computed(() => {
  if (!semSearch.value) return semesterList.value
  const q = semSearch.value.toLowerCase()
  return semesterList.value.filter(s =>
    (s.name ?? s.code ?? '').toLowerCase().includes(q) ||
    (s.code ?? '').toLowerCase().includes(q)
  )
})

const filteredCurriculums = computed(() => {
  if (!currSearch.value) return curriculums.value
  const q = currSearch.value.toLowerCase()
  return curriculums.value.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.description ?? '').toLowerCase().includes(q)
  )
})

function getVersionsOfCurriculum(curriculum: Curriculum): CurriculumVersion[] {
  const id = curriculum._id || curriculum.id || ''
  return curriculumVersions.value
    .filter(v => v.curriculumId === id)
    .sort((a, b) => a.versionNumber - b.versionNumber)
}

function getActiveVersion(curriculum: Curriculum): CurriculumVersion | undefined {
  const activeId = curriculum.activeVersionId
  if (!activeId) return undefined
  return curriculumVersions.value.find(v => (v._id || v.id) === activeId)
}

function getProgramCount(curriculum: Curriculum): number {
  const id = curriculum._id || curriculum.id || ''
  return programs.value.filter(p => p.curriculumId === id).length
}

function getModuleCount(curriculum: Curriculum): number {
  const versions = getVersionsOfCurriculum(curriculum)
  const versionIds = new Set(versions.map(v => v._id || v.id || ''))
  return modules.value.filter(m => versionIds.has(m.curriculumVersionId || '')).length
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

function openAddCurriculum() {
  editCurriculum.value = null
  currDialogOpen.value = true
}

function openEditCurriculum(curr: Curriculum) {
  editCurriculum.value = curr
  currDialogOpen.value = true
}

async function handleCurriculumSave(curr: Curriculum) {
  try {
    if (curr.id || curr._id) {
      await updateCurriculum(curr)
      showSnackbar('Curriculum updated')
    } else {
      const created = await createCurriculumWithV1(curr.name, curr.description || '')
      showSnackbar('Curriculum created')
      const createdId = created?.id || created?._id
      if (createdId) displayedCurriculumId.value = createdId
      // Refresh so the new V1 shows up in the versions list right away.
      await fetchCurriculumVersions()
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteCurriculum(curr: Curriculum) {
  deleteKind = 'curriculum'
  deleteId = curr._id || curr.id || ''
  deleteTargetName.value = curr.name
  deleteDialogOpen.value = true
}

async function addVersionToCurriculum(curr: Curriculum) {
  const id = curr._id || curr.id || ''
  if (!id) return
  try {
    await addVersionToCurriculumApi(id)
    showSnackbar('New version created')
    // Refresh so the copied version shows up in the versions list right away.
    await fetchCurriculumVersions()
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

async function setActiveVersion(curr: Curriculum, version: CurriculumVersion) {
  const currId = curr._id || curr.id || ''
  const versionId = version._id || version.id || ''
  if (!currId || !versionId) return
  try {
    await setActiveVersionApi(currId, versionId)
    showSnackbar(`V${version.versionNumber} is now active`)
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

/** Entry point from the version rows: show this version's content tabs. */
function manageVersion(version: CurriculumVersion) {
  const versionId = version._id || version.id || ''
  if (!versionId) return
  if (version.curriculumId) displayedCurriculumId.value = version.curriculumId
  displayedVersionId.value = versionId
  curriculumTab.value = 'programs'
  nextTick(() => {
    contentSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function openAddDepartment() {
  editDepartment.value = undefined
  deptDialogOpen.value = true
}

function openEditDepartment(dept: Department) {
  editDepartment.value = dept
  deptDialogOpen.value = true
}

async function handleDepartmentSave(dept: Department) {
  try {
    if (dept.id) {
      await updateDepartment(dept)
      showSnackbar('Department updated')
    } else {
      await addDepartment(dept)
      showSnackbar('Department added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteDepartment(dept: Department) {
  deleteKind = 'department'
  deleteId = dept.id ?? ''
  deleteTargetName.value = dept.name
  deleteDialogOpen.value = true
}

function openAddProgram() {
  if (!displayedCurriculumId.value) {
    showSnackbar('Select a curriculum first: programs cannot exist without one', 'error')
    return
  }
  editProgram.value = undefined
  progDialogOpen.value = true
}

function openEditProgram(prog: Program) {
  editProgram.value = prog
  progDialogOpen.value = true
}

async function handleProgramSave(prog: Program) {
  try {
    if (prog.id) {
      await updateProgram(prog)
      showSnackbar('Program updated')
    } else {
      // Programs always belong to the currently displayed curriculum.
      prog.curriculumId = displayedCurriculumId.value
      await addProgram(prog)
      showSnackbar('Program added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteProgram(prog: Program) {
  deleteKind = 'program'
  deleteId = prog.id ?? ''
  deleteTargetName.value = prog.name
  deleteDialogOpen.value = true
}

function openAddDegree() {
  if (!displayedCurriculumId.value) {
    showSnackbar('Select a curriculum first: degrees are created within one of its programs', 'error')
    return
  }
  editDegree.value = undefined
  degDialogOpen.value = true
}

function openEditDegree(deg: Degree) {
  editDegree.value = deg
  degDialogOpen.value = true
}

async function handleDegreeSave(deg: Degree) {
  try {
    if (deg.id) {
      await updateDegree(deg)
      showSnackbar('Degree updated')
    } else {
      await addDegree(deg)
      showSnackbar('Degree added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteDegree(deg: Degree) {
  deleteKind = 'degree'
  deleteId = deg.id ?? ''
  deleteTargetName.value = deg.name
  deleteDialogOpen.value = true
}

function openAddModule() {
  if (!displayedVersionId.value) {
    showSnackbar('Select a curriculum version first: modules cannot exist without one', 'error')
    return
  }
  editModule.value = undefined
  modDialogOpen.value = true
}

function openEditModule(mod: Module) {
  editModule.value = mod
  modDialogOpen.value = true
}

async function handleModuleSave(mod: Module) {
  try {
    const classIds = (mod as Module & { classIds?: string[] }).classIds || []
    delete (mod as Module & { classIds?: string[] }).classIds
    if (mod.id) {
      await updateModule(mod)
      showSnackbar('Module updated')
    } else {
      // Modules are created within the currently displayed curriculum version
      mod.curriculumVersionId = displayedVersionId.value
      await addModule(mod)
      showSnackbar('Module added')
    }
    const moduleId = mod.id || modules.value.find(m => m.code === mod.code && m.name === mod.name)?.id
    if (moduleId) {
      for (const cls of classes.value) {
        const id = cls.id || cls._id
        if (!id) continue
        const current = cls.moduleIds || []
        const shouldInclude = classIds.includes(id)
        const hasModule = current.includes(moduleId)
        if (shouldInclude !== hasModule) {
          await updateClass({ ...cls, moduleIds: shouldInclude ? [...current, moduleId] : current.filter(x => x !== moduleId) })
        }
      }
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteModule(mod: Module) {
  deleteKind = 'module'
  deleteId = mod.id ?? ''
  deleteTargetName.value = mod.name
  deleteDialogOpen.value = true
}

function openAddClass() {
  if (!displayedVersionId.value) {
    showSnackbar('Select a curriculum version first: classes cannot exist without one', 'error')
    return
  }
  editClass.value = undefined
  clsDialogOpen.value = true
}

function openEditClass(cls: ClassEntity) {
  editClass.value = cls
  clsDialogOpen.value = true
}

async function handleClassSave(cls: ClassEntity) {
  try {
    if (cls.id) {
      await updateClass(cls)
      showSnackbar('Class updated')
    } else {
      // Classes are created within the currently displayed curriculum version
      cls.curriculumVersionId = displayedVersionId.value
      await addClass(cls)
      showSnackbar('Class added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteClass(cls: ClassEntity) {
  deleteKind = 'class'
  deleteId = cls.id ?? ''
  deleteTargetName.value = cls.name
  deleteDialogOpen.value = true
}

function openAddSemester() {
  editSemester.value = null
  semDialogOpen.value = true
}

function openEditSemester(sem: Semester) {
  editSemester.value = JSON.parse(JSON.stringify(sem))
  semDialogOpen.value = true
}

async function handleSemesterSave(sem: Semester) {
  try {
    if (sem._id || sem.id) {
      await updateSemester(sem)
      showSnackbar('Semester updated')
    } else {
      await addSemester(sem)
      showSnackbar('Semester added')
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteSemester(sem: Semester) {
  deleteKind = 'semester'
  deleteId = sem._id || sem.id || ''
  deleteTargetName.value = sem.name ?? sem.code ?? 'Unnamed Semester'
  deleteDialogOpen.value = true
}

function openEditVersion(version: CurriculumVersion) {
  editVersion.value = JSON.parse(JSON.stringify(version))
  verDialogOpen.value = true
}

async function handleVersionSave(version: CurriculumVersion) {
  try {
    await updateCurriculumVersion(version)
    showSnackbar('Curriculum version updated')
    await fetchCurriculumVersions()
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteVersion(version: CurriculumVersion) {
  deleteKind = 'version'
  deleteId = version._id || version.id || ''
  deleteTargetName.value = version.name || `Version ${version.versionNumber}`
  deleteDialogOpen.value = true
}

async function handleDelete() {
  try {
    if (deleteKind === 'curriculum') {
      await removeCurriculum(deleteId)
      showSnackbar('Curriculum deleted')
    } else if (deleteKind === 'department') {
      await removeDepartment(deleteId)
      showSnackbar('Department deleted')
    } else if (deleteKind === 'program') {
      await removeProgram(deleteId)
      showSnackbar('Program deleted')
    } else if (deleteKind === 'degree') {
      await removeDegree(deleteId)
      showSnackbar('Degree deleted')
    } else if (deleteKind === 'class') {
      await removeClass(deleteId)
      showSnackbar('Class deleted')
    } else if (deleteKind === 'semester') {
      await removeSemester(deleteId)
      showSnackbar('Semester deleted')
    } else if (deleteKind === 'version') {
      await removeCurriculumVersion(deleteId)
      showSnackbar('Curriculum version deleted')
    } else {
      await removeModule(deleteId)
      showSnackbar('Module deleted')
    }
  } catch {
    showSnackbar('Deletion failed', 'error')
  }
  deleteDialogOpen.value = false
}

function openCsvImport(type: ImportType) {
  if (type === 'programs' && !displayedCurriculumId.value) {
    showSnackbar('Select a curriculum first: programs cannot exist without one', 'error')
    return
  }
  if (type === 'modules' && !displayedVersionId.value) {
    showSnackbar('Select a curriculum version first: modules cannot exist without one', 'error')
    return
  }
  csvImportType.value = type
  csvImportDialogOpen.value = true
}

async function handleCsvImported(payload: { type: ImportType; count: number; items: any[] }) {
  const labelMap: Record<string, string> = {
    departments: 'department',
    programs: 'program',
    degrees: 'degree',
    modules: 'module',
  }
  if (payload.type === 'departments') {
    await fetchDepartments()
  } else if (payload.type === 'programs') {
    await fetchPrograms()
  } else if (payload.type === 'degrees') {
    await fetchDegrees()
  } else if (payload.type === 'modules') {
    await fetchModules()
  }
  const singular = labelMap[payload.type] || payload.type
  showSnackbar(`${payload.count} ${singular}${payload.count === 1 ? '' : 's'} imported successfully`)
}

function showSnackbar(text: string, color: string = 'success') {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

onMounted(() => {
  fetchDepartments()
  fetchPrograms()
  fetchDegrees()
  fetchModules()
  fetchClasses()
  fetchSemesters()
  fetchCurriculums()
  fetchCurriculumVersions()
})
</script>
