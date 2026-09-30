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
            <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
          </template>
          <template #item.actions="{ item }">
            <template v-if="item._canEdit">
              <v-btn icon variant="text" size="small" @click="openEditDepartment(item)">
                <v-icon>mdi-pencil</v-icon>
                <v-tooltip activator="parent">Edit</v-tooltip>
              </v-btn>
              <v-btn icon variant="text" size="small" @click="confirmDeleteDepartment(item)">
                <v-icon>mdi-delete</v-icon>
                <v-tooltip activator="parent">Delete</v-tooltip>
              </v-btn>
            </template>
            <span v-else class="text-medium-emphasis text-caption">Read-only</span>
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

      <!-- Curriculum Tab (version selector + curriculum-dependent sub-tabs) -->
      <v-window-item value="curriculum">
        <v-row dense class="mb-2">
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="displayedVersionId"
              :items="displayedVersionItems"
              label="Displayed curriculum version"
              prepend-inner-icon="mdi-source-branch"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>

        <v-tabs v-model="curriculumTab" bg-color="transparent" color="primary">
          <v-tab value="versions">
            <v-icon start>mdi-source-branch</v-icon>
            Versions
          </v-tab>
          <template v-if="hasDisplayedVersion">
            <v-tab value="programs">Programs</v-tab>
            <v-tab value="degrees">Degrees</v-tab>
            <v-tab value="modules">Modules</v-tab>
            <v-tab value="classes">Classes</v-tab>
          </template>
        </v-tabs>

        <div v-if="curriculumTab === 'versions'" class="mt-4">
          <v-row class="align-center mb-4">
            <v-col cols="12" sm="6" class="d-flex ga-2">
              <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddVersion">Add Version</v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="versionSearch"
                prepend-inner-icon="mdi-magnify"
                label="Search versions"
                single-line
                hide-details
                clearable
                density="compact"
              />
            </v-col>
          </v-row>

          <v-data-table
            :headers="verHeaders"
            :items="filteredVersions"
            :sort-by="verSortBy"
            @update:sort-by="verSortBy = $event"
            hover
            items-per-page="15"
          >
            <template #item.name="{ item }">
              <span class="font-weight-medium">{{ item.name || `v${item.versionNumber}` }}</span>
              <v-chip v-if="isActiveVersion(item)" size="x-small" color="success" variant="tonal" class="ml-1">Active</v-chip>
              <v-chip v-if="(item._id || item.id) === displayedVersionId" size="x-small" color="info" variant="tonal" class="ml-1">Displayed</v-chip>
            </template>
            <template #item.versionNumber="{ item }">
              {{ item.versionNumber }}
            </template>
            <template #item.programId="{ item }">
              {{ getProgramName(item.programId) }}
            </template>
            <template #item.createdAt="{ item }">
              {{ item.createdAt ? formatDate(item.createdAt) : '—' }}
            </template>
            <template #item.actions="{ item }">
              <template v-if="auth.isAdmin">
                <v-btn
                  icon
                  variant="text"
                  size="small"
                  :disabled="getActiveVersionIds().includes(item._id || item.id || '')"
                  @click="setAsActiveVersion(item)"
                >
                  <v-icon>mdi-star-outline</v-icon>
                  <v-tooltip activator="parent" location="top">
                    {{ getActiveVersionIds().includes(item._id || item.id || '') ? 'This is the active version' : 'Set as active version of its program' }}
                  </v-tooltip>
                </v-btn>
                <v-btn icon variant="text" size="small" @click="openEditVersion(item)">
                  <v-icon>mdi-pencil</v-icon>
                  <v-tooltip activator="parent">Edit</v-tooltip>
                </v-btn>
                <v-btn icon variant="text" size="small" @click="confirmDeleteVersion(item)">
                  <v-icon>mdi-delete</v-icon>
                  <v-tooltip activator="parent">Delete</v-tooltip>
                </v-btn>
              </template>
              <span v-else class="text-medium-emphasis text-caption">Read-only</span>
            </template>
            <template #no-data>
              <div class="text-center pa-4">
                <v-icon size="64" color="grey-lighten-1">mdi-source-branch</v-icon>
                <p class="mt-2 text-medium-emphasis">No curriculum versions found.</p>
                <p class="text-caption text-medium-emphasis">Add a version to snapshot a program's curriculum.</p>
              </div>
            </template>
          </v-data-table>
        </div>

        <template v-if="hasDisplayedVersion">
          <div v-if="curriculumTab === 'programs'">
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
                <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              </template>
              <template #item.actions="{ item }">
                <template v-if="item._canEdit">
                  <v-btn icon variant="text" size="small" @click="openEditProgram(item)">
                    <v-icon>mdi-pencil</v-icon>
                    <v-tooltip activator="parent">Edit</v-tooltip>
                  </v-btn>
                  <v-btn icon variant="text" size="small" @click="confirmDeleteProgram(item)">
                    <v-icon>mdi-delete</v-icon>
                    <v-tooltip activator="parent">Delete</v-tooltip>
                  </v-btn>
                </template>
                <span v-else class="text-medium-emphasis text-caption">Read-only</span>
              </template>
              <template #no-data>
                <div class="text-center pa-4">
                  <v-icon size="64" color="grey-lighten-1">mdi-school-outline</v-icon>
                  <p class="mt-2 text-medium-emphasis">No programs found.</p>
                </div>
              </template>
            </v-data-table>
          </div>

          <div v-if="curriculumTab === 'degrees'">
            <v-row class="align-center mb-4">
              <v-col cols="12" sm="6" class="d-flex ga-2">
                <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddDegree">Add Degree</v-btn>
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
                <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              </template>
              <template #item.actions="{ item }">
                <template v-if="item._canEdit">
                  <v-btn icon variant="text" size="small" @click="openEditDegree(item)">
                    <v-icon>mdi-pencil</v-icon>
                    <v-tooltip activator="parent">Edit</v-tooltip>
                  </v-btn>
                  <v-btn icon variant="text" size="small" @click="confirmDeleteDegree(item)">
                    <v-icon>mdi-delete</v-icon>
                    <v-tooltip activator="parent">Delete</v-tooltip>
                  </v-btn>
                </template>
                <span v-else class="text-medium-emphasis text-caption">Read-only</span>
              </template>
              <template #no-data>
                <div class="text-center pa-4">
                  <v-icon size="64" color="grey-lighten-1">mdi-certificate-outline</v-icon>
                  <p class="mt-2 text-medium-emphasis">No degrees found.</p>
                </div>
              </template>
            </v-data-table>
          </div>

          <div v-if="curriculumTab === 'modules'">
            <v-row class="align-center mb-4">
              <v-col cols="12" sm="6" class="d-flex ga-2">
                <v-btn v-if="auth.isAdmin" color="primary" prepend-icon="mdi-plus" @click="openAddModule">Add Module</v-btn>
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
                {{ item.creditPoints ?? '-' }}
              </template>
              <template #item.contactHours="{ item }">
                {{ item.contactHours ?? '-' }}
              </template>
              <template #item.constraints="{ item }">
                <template v-if="item.constraints && item.constraints.length">
                  <v-chip
                    v-for="(c, idx) in item.constraints"
                    :key="idx"
                    size="x-small"
                    :color="c.type === 'requires' ? 'info' : c.type === 'corequisite' ? 'warning' : 'error'"
                    variant="tonal"
                    class="mr-1"
                  >
                    {{ c.type }}: {{ getModuleName(c.targetModuleId) }}
                  </v-chip>
                </template>
                <span v-else class="text-medium-emphasis">-</span>
              </template>
              <template #item.name="{ item }">
                <span>{{ item.name }}</span>
                <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              </template>
              <template #item.actions="{ item }">
                <template v-if="item._canEdit">
                  <v-btn icon variant="text" size="small" @click="openEditModule(item)">
                    <v-icon>mdi-pencil</v-icon>
                    <v-tooltip activator="parent">Edit</v-tooltip>
                  </v-btn>
                  <v-btn icon variant="text" size="small" @click="confirmDeleteModule(item)">
                    <v-icon>mdi-delete</v-icon>
                    <v-tooltip activator="parent">Delete</v-tooltip>
                  </v-btn>
                </template>
                <span v-else class="text-medium-emphasis text-caption">Read-only</span>
              </template>
              <template #no-data>
                <div class="text-center pa-4">
                  <v-icon size="64" color="grey-lighten-1">mdi-book-open-page-variant</v-icon>
                  <p class="mt-2 text-medium-emphasis">No modules found.</p>
                </div>
              </template>
            </v-data-table>
          </div>

          <div v-if="curriculumTab === 'classes'">
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
                <v-chip v-if="item._canEdit" size="x-small" variant="tonal" color="primary" class="ml-1">Admin</v-chip>
              </template>
              <template #item.actions="{ item }">
                <template v-if="item._canEdit">
                  <v-btn icon variant="text" size="small" @click="openEditClass(item)">
                    <v-icon>mdi-pencil</v-icon>
                    <v-tooltip activator="parent">Edit</v-tooltip>
                  </v-btn>
                  <v-btn icon variant="text" size="small" @click="confirmDeleteClass(item)">
                    <v-icon>mdi-delete</v-icon>
                    <v-tooltip activator="parent">Delete</v-tooltip>
                  </v-btn>
                </template>
                <span v-else class="text-medium-emphasis text-caption">Read-only</span>
              </template>
              <template #no-data>
                <div class="text-center pa-4">
                  <v-icon size="64" color="grey-lighten-1">mdi-account-group</v-icon>
                  <p class="mt-2 text-medium-emphasis">No classes found.</p>
                </div>
              </template>
            </v-data-table>
          </div>
        </template>
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
      @save="handleModuleSave"
    />

    <ClassFormDialog
      v-model="clsDialogOpen"
      :class-data="editClass"
      :programs="programsOfDisplayedVersion"
      :degrees="degreesOfDisplayedVersion"
      :semesters="semesterList"
      @save="handleClassSave"
    />

    <SemesterFormDialog
      v-model="semDialogOpen"
      :semester-data="editSemester"
      @save="handleSemesterSave"
    />

    <CurriculumVersionFormDialog
      v-model="verDialogOpen"
      :version-data="editVersion"
      @save="handleVersionSave"
    />

    <CsvImportDialog
      v-model="csvImportDialogOpen"
      :initial-type="csvImportType"
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
import { ref, computed, onMounted, watch } from 'vue'
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
import CurriculumVersionFormDialog from '@/components/CurriculumVersionFormDialog.vue'
import { useCurriculumVersions } from '@/composables/useCurriculumVersions'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import type { Department, Program, Degree, Module } from '@/types/curriculum'
import type { ClassEntity } from '@/types/curriculumClass'
import type { Semester, CurriculumVersion } from '@/stores/curriculum'
import type { ImportType } from '@/types/csvImport'

const auth = useAuthStore()

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
  curriculumVersions,
  fetchCurriculumVersions,
  addCurriculumVersion,
  updateCurriculumVersion,
  removeCurriculumVersion,
} = useCurriculumVersions()

const activeTab = ref<'curriculum' | 'departments' | 'semesters'>('curriculum')
const curriculumTab = ref<'versions' | 'programs' | 'degrees' | 'modules' | 'classes'>('versions')

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

const versionSearch = ref('')
const verDialogOpen = ref(false)
const editVersion = ref<CurriculumVersion | null>(null)
const verSortBy = ref<{ key: string; order: 'asc' | 'desc' }[]>([{ key: 'versionNumber', order: 'desc' }])

const displayedVersionId = ref<string>('')

const csvImportDialogOpen = ref(false)
const csvImportType = ref<ImportType>('departments')

const deleteDialogOpen = ref(false)
const deleteTargetName = ref('')
let deleteKind: 'department' | 'program' | 'degree' | 'module' | 'class' | 'semester' | 'version' = 'department'
let deleteId = ''

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const deptHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const progHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Departments', key: 'departmentIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const degHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Programs', key: 'ProgramIDs', sortable: false },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Contact', key: 'contact', sortable: true },
  { title: 'URL', key: 'url', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const modHeaders = [
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Degrees', key: 'DegreeIDs', sortable: false },
  { title: 'ECTS', key: 'creditPoints', sortable: true },
  { title: 'Contact hrs', key: 'contactHours', sortable: true },
  { title: 'Constraints', key: 'constraints', sortable: false },
  { title: '', key: 'actions', sortable: false, width: '100px' },
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
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const semHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Start', key: 'startDate', sortable: true },
  { title: 'End', key: 'endDate', sortable: true },
  { title: '', key: 'actions', sortable: false, width: '100px' },
]

const verHeaders = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Version', key: 'versionNumber', sortable: true },
  { title: 'Program', key: 'programId', sortable: false },
  { title: 'Created', key: 'createdAt', sortable: true },
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

function getModuleName(moduleId: string): string {
  const mod = modules.value.find(m => m.id === moduleId)
  return mod ? (mod.code || mod.name) : moduleId
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

const filteredPrograms = computed(() => {
  if (!progSearch.value) return programs.value
  const q = progSearch.value.toLowerCase()
  return programs.value.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.description ?? '').toLowerCase().includes(q) ||
    (p.contact ?? '').toLowerCase().includes(q) ||
    getDepartmentNames(p).some(n => n.toLowerCase().includes(q))
  )
})

// Programs of the displayed curriculum version — only these can be selected
// when adding/editing a degree within the displayed curriculum.
const programsOfDisplayedVersion = computed(() =>
  displayedVersionId.value === ''
    ? programs.value
    : programs.value.filter(p => p.activeCurriculumVersionId === displayedVersionId.value)
)

// Degrees of the displayed curriculum version, derived via their parent
// programs (degrees carry no curriculum version themselves).
const degreesOfDisplayedVersion = computed(() =>
  displayedVersionId.value === ''
    ? degrees.value
    : degrees.value.filter(d => {
        const degreeId = d.id
        if (!degreeId) return false
        return programsOfDisplayedVersion.value.some(p =>
          (p.id ? (d.programIds ?? d.programIDs ?? d.ProgramIDs ?? []).includes(p.id) : false)
        )
      })
)

const filteredDegrees = computed(() => {
  // Degrees belong to the displayed curriculum via their parent programs:
  // a degree is shown if at least one of its programs has the displayed
  // version as its active curriculum version.
  const programIdsOfVersion = new Set(
    programs.value
      .filter(p => p.activeCurriculumVersionId === displayedVersionId.value)
      .map(p => p.id)
  )
  const base = displayedVersionId.value === ''
    ? degrees.value
    : degrees.value.filter(d =>
        (d.programIds ?? d.programIDs ?? d.ProgramIDs ?? []).some(pid => programIdsOfVersion.has(pid))
      )
  if (!degSearch.value) return base
  const q = degSearch.value.toLowerCase()
  return base.filter(d =>
    d.name.toLowerCase().includes(q) ||
    (d.description ?? '').toLowerCase().includes(q) ||
    (d.contact ?? '').toLowerCase().includes(q) ||
    getProgramNames(d).some(n => n.toLowerCase().includes(q))
  )
})

const filteredModules = computed(() => {
  const base = modules.value.filter(m =>
    displayedVersionId.value === '' || m.curriculumVersionId === displayedVersionId.value
  )
  if (!modSearch.value) return base
  const q = modSearch.value.toLowerCase()
  return base.filter(m =>
    m.name.toLowerCase().includes(q) ||
    (m.code ?? '').toLowerCase().includes(q) ||
    (m.description ?? '').toLowerCase().includes(q) ||
    (m.contact ?? '').toLowerCase().includes(q) ||
    getDegreeNames(m).some(n => n.toLowerCase().includes(q))
  )
})

const filteredClasses = computed(() => {
  const base = classes.value.filter(c =>
    displayedVersionId.value === '' || c.curriculumVersionId === displayedVersionId.value
  )
  if (!clsSearch.value) return base
  const q = clsSearch.value.toLowerCase()
  return base.filter(c =>
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

const filteredVersions = computed(() => {
  if (!versionSearch.value) return curriculumVersions.value
  const q = versionSearch.value.toLowerCase()
  return curriculumVersions.value.filter(v =>
    (v.name ?? '').toLowerCase().includes(q) ||
    String(v.versionNumber).includes(q) ||
    getProgramName(v.programId).toLowerCase().includes(q)
  )
})

// ── Displayed curriculum version ─────────────────────────────────
const hasDisplayedVersion = computed(() => displayedVersionId.value !== '')

const displayedVersionItems = computed(() => [
  { title: 'No version selected', value: '' },
  ...curriculumVersions.value.map(v => ({
    title: `${v.name || 'Version'} (v${v.versionNumber}) — ${getProgramName(v.programId)}`,
    value: v._id || v.id || '',
  })).filter(i => i.value),
])

// Default: active version of the first program that declares one, else 'All'
watch(() => curriculumVersions.value.length, () => {
  if (!displayedVersionId.value) {
    const withActive = programs.value.find(p => !!p.activeCurriculumVersionId)
    if (withActive?.activeCurriculumVersionId) {
      const exists = curriculumVersions.value.some(v => (v._id || v.id) === withActive.activeCurriculumVersionId)
      if (exists) displayedVersionId.value = withActive.activeCurriculumVersionId
    }
  }
})

// Curriculum-dependent sub-tabs require a displayed version; if the selection
// is cleared (or the displayed version is deleted), fall back to Versions.
watch(hasDisplayedVersion, (has) => {
  if (!has) {
    curriculumTab.value = 'versions'
  }
})

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
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
      // Programs are created within the currently displayed curriculum version
      prog.activeCurriculumVersionId = displayedVersionId.value
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

function openAddVersion() {
  editVersion.value = null
  verDialogOpen.value = true
}

function openEditVersion(version: CurriculumVersion) {
  editVersion.value = JSON.parse(JSON.stringify(version))
  verDialogOpen.value = true
}

async function handleVersionSave(version: CurriculumVersion) {
  try {
    if (version._id || version.id) {
      await updateCurriculumVersion(version)
      showSnackbar('Curriculum version updated')
    } else {
      // Version number is system-assigned: next free number across all versions
      const taken = new Set(curriculumVersions.value.map(v => v.versionNumber))
      let next = 1
      while (taken.has(next)) next++
      version.versionNumber = next
      await addCurriculumVersion(version)
      showSnackbar(`Curriculum version v${next} added`)
    }
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function getProgramName(programId: string | undefined): string {
  if (!programId) return '—'
  const prog = programs.value.find(p => p.id === programId)
  return prog ? (prog.name || programId) : programId
}

function getActiveVersionIds(): string[] {
  return programs.value
    .map(p => p.activeCurriculumVersionId)
    .filter((id): id is string => !!id)
}

function isActiveVersion(version: CurriculumVersion): boolean {
  const id = version._id || version.id
  return !!id && getActiveVersionIds().includes(id)
}

async function setAsActiveVersion(version: CurriculumVersion) {
  const versionId = version._id || version.id
  if (!versionId || !version.programId) return
  const prog = programs.value.find(p => p.id === version.programId)
  if (!prog) return
  try {
    await updateProgram({ ...prog, activeCurriculumVersionId: versionId })
    showSnackbar(`Set as active version of ${prog.name || 'program'}`)
  } catch {
    showSnackbar('Operation failed', 'error')
  }
}

function confirmDeleteVersion(version: CurriculumVersion) {
  const versionId = version._id || version.id || ''
  const references: string[] = []
  if (programs.value.some(p => p.activeCurriculumVersionId === versionId)) {
    references.push('a program uses it as its active version')
  }
  const moduleCount = modules.value.filter(m => m.curriculumVersionId === versionId).length
  if (moduleCount > 0) references.push(`${moduleCount} module${moduleCount === 1 ? '' : 's'}`)
  const classCount = classes.value.filter(c => c.curriculumVersionId === versionId).length
  if (classCount > 0) references.push(`${classCount} class${classCount === 1 ? '' : 'es'}`)
  if (references.length > 0) {
    showSnackbar(`Cannot delete: referenced by ${references.join(' and ')}. Remove those references first.`, 'error')
    return
  }
  deleteKind = 'version'
  deleteId = versionId
  deleteTargetName.value = version.name || `Version ${version.versionNumber}`
  deleteDialogOpen.value = true
}

async function handleDelete() {
  try {
    if (deleteKind === 'department') {
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
      if (displayedVersionId.value === deleteId) displayedVersionId.value = ''
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
  fetchCurriculumVersions()
})
</script>
