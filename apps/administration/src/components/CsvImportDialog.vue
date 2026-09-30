<template>
  <v-dialog
    :model-value="modelValue"
    max-width="960"
    scrollable
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="csv-import-dialog">
      <!-- Dialog Header -->
      <v-card-item class="bg-primary text-white py-3">
        <template #prepend>
          <v-icon icon="mdi-file-delimited-outline" size="large" class="me-2" />
        </template>
        <v-card-title class="text-h6 font-weight-medium">Import CSV Data</v-card-title>
        <v-card-subtitle class="text-white text-opacity-80">
          Upload a CSV file and map columns to {{ currentConfig.label.toLowerCase() }} variables
        </v-card-subtitle>
        <template #append>
          <v-btn icon="mdi-close" variant="text" density="comfortable" @click="closeDialog" />
        </template>
      </v-card-item>

      <v-card-text class="pa-4 pa-sm-6">
        <!-- Error Alert -->
        <v-alert
          v-if="errorMessage"
          type="error"
          variant="tonal"
          closable
          class="mb-4"
          @click:close="errorMessage = null"
        >
          {{ errorMessage }}
        </v-alert>

        <!-- Import Type Selector -->
        <v-row dense class="mb-4">
          <v-col cols="12" md="6">
            <v-select
              v-model="selectedType"
              :items="availableTypeOptions"
              item-title="title"
              item-value="value"
              label="Import Type"
              prepend-inner-icon="mdi-format-list-bulleted-type"
              variant="outlined"
              density="compact"
              hide-details
              @update:model-value="handleTypeChange"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps" :subtitle="(item as any).subtitle || (item as any).raw?.subtitle">
                  <template #prepend>
                    <v-icon :icon="(item as any).icon || (item as any).raw?.icon" class="me-2" />
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center">
            <v-chip color="primary" variant="tonal" size="small" class="me-2">
              <v-icon start :icon="currentConfig.icon" />
              {{ currentConfig.label }}
            </v-chip>
            <span class="text-caption text-medium-emphasis">
              {{ currentConfig.description }}
            </span>
          </v-col>
        </v-row>

        <v-divider class="mb-4" />

        <!-- Field Requirements Overview -->
        <div class="mb-4">
          <div class="d-flex align-center justify-space-between mb-2">
            <h3 class="text-subtitle-1 font-weight-bold d-flex align-center">
              <v-icon start color="primary" icon="mdi-format-list-checks" />
              Required Fields
            </h3>
            <v-btn-toggle v-model="fieldsOverviewMode" density="compact" mandatory color="primary" variant="outlined">
              <v-btn value="compact" size="small">Summary</v-btn>
              <v-btn value="detailed" size="small">Detailed</v-btn>
            </v-btn-toggle>
          </div>

          <!-- Compact Summary -->
          <template v-if="fieldsOverviewMode === 'compact'">
            <div class="d-flex flex-wrap ga-2">
              <v-chip
                v-for="field in currentConfig.fields"
                :key="field.key"
                size="small"
                :variant="field.required ? 'flat' : 'tonal'"
                :color="field.required ? 'error' : 'default'"
              >
                <span>{{ field.label }}</span>
                <v-icon v-if="field.required" end size="x-small">mdi-asterisk</v-icon>
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis mt-2">
              <v-icon size="x-small" icon="mdi-asterisk" color="error" class="me-1" /> Mandatory
              <span class="mx-1">|</span>
              <span class="text-medium-emphasis">Optional</span>
              <span class="mx-1">|</span>
              {{ mandatoryFields.length }} mandatory, {{ optionalFields.length }} optional
            </div>
          </template>

          <!-- Detailed View -->
          <template v-else>
            <v-row dense>
              <v-col cols="12" md="6">
                <v-card variant="outlined" class="mb-2">
                  <v-card-item class="bg-red-lighten-5 py-2">
                    <div class="font-weight-bold text-red-darken-3 d-flex align-center">
                      <v-icon icon="mdi-asterisk" size="small" color="red" class="me-1" />
                      Mandatory ({{ mandatoryFields.length }})
                    </div>
                  </v-card-item>
                  <v-divider />
                  <v-card-text class="pa-2">
                    <div
                      v-for="field in mandatoryFields"
                      :key="field.key"
                      class="d-flex align-center justify-space-between py-1"
                    >
                      <div class="d-flex align-center">
                        <v-icon size="x-small" icon="mdi-circle-small" class="me-1" />
                        <span class="text-body-2 font-weight-medium">{{ field.label }}</span>
                      </div>
                      <v-chip size="x-small" variant="text" class="text-caption text-disabled">
                        {{ field.type }}<template v-if="field.options"> ({{ field.options.join(', ') }})</template>
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card variant="outlined" class="mb-2">
                  <v-card-item class="py-2">
                    <div class="font-weight-medium text-body-2 d-flex align-center">
                      <v-icon icon="mdi-information-outline" size="small" class="me-1 text-medium-emphasis" />
                      Optional ({{ optionalFields.length }})
                    </div>
                  </v-card-item>
                  <v-divider />
                  <v-card-text class="pa-2">
                    <div
                      v-for="field in optionalFields"
                      :key="field.key"
                      class="d-flex align-center justify-space-between py-1"
                    >
                      <div class="d-flex align-center">
                        <v-icon size="x-small" icon="mdi-circle-small" class="me-1" />
                        <span class="text-body-2">{{ field.label }}</span>
                      </div>
                      <v-chip size="x-small" variant="text" class="text-caption text-disabled">
                        {{ field.type }}<template v-if="field.options"> ({{ field.options.join(', ') }})</template>
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </template>
        </div>

        <v-divider class="mb-4" />

        <!-- Source Input: File Upload or Raw CSV Text -->
        <div class="mb-4">
          <v-tabs v-model="inputTab" density="compact" color="primary" class="mb-3">
            <v-tab value="file">
              <v-icon start>mdi-upload</v-icon>
              Upload File
            </v-tab>
            <v-tab value="paste">
              <v-icon start>mdi-clipboard-text-outline</v-icon>
              Paste CSV Text
            </v-tab>
          </v-tabs>

          <v-window v-model="inputTab">
            <!-- File Upload Area -->
            <v-window-item value="file">
              <div
                class="csv-dropzone pa-6 text-center rounded-lg border border-dashed cursor-pointer"
                :class="{ 'bg-primary-lighten-5 border-primary': isDragging }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
                @click="fileInputRef?.click()"
              >
                <input
                  ref="fileInputRef"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  class="d-none"
                  @change="handleFileSelected"
                >
                <v-icon size="40" color="primary" class="mb-2">mdi-cloud-upload</v-icon>
                <div class="text-body-1 font-weight-medium">
                  {{ fileName || 'Click or drag & drop a CSV file here' }}
                </div>
                <div class="text-caption text-medium-emphasis mt-1">
                  Supports comma, semicolon, or tab delimited UTF-8 CSV files
                </div>
              </div>
            </v-window-item>

            <!-- Paste CSV Text Area -->
            <v-window-item value="paste">
              <v-textarea
                v-model="rawCsvText"
                label="Paste CSV data"
                rows="4"
                variant="outlined"
                density="compact"
                placeholder="name,building,campus&#10;Science Lab,Science Building,North Campus"
                hide-details
                @input="handlePasteInput"
              />
            </v-window-item>
          </v-window>

          <!-- CSV Parsing Options -->
          <div class="d-flex align-center flex-wrap ga-4 mt-2">
            <v-checkbox
              v-model="hasHeader"
              label="First row contains header / column names"
              density="compact"
              color="primary"
              hide-details
              @update:model-value="reparseCsv"
            />
          </div>
        </div>

        <!-- Section 2: CSV Details & Column Mapping -->
        <template v-if="parsedCsv && parsedCsv.headers.length > 0">
          <v-card variant="flat" color="surface-variant" class="mb-4 pa-3">
            <div class="d-flex flex-wrap align-center justify-space-between ga-2">
              <div class="d-flex align-center flex-wrap ga-2">
                <v-chip size="small" variant="flat" color="primary">
                  <v-icon start icon="mdi-table-headers-eye" />
                  {{ parsedCsv.headers.length }} Columns detected
                </v-chip>
                <v-chip size="small" variant="flat" color="secondary">
                  <v-icon start icon="mdi-format-list-numbered" />
                  {{ parsedCsv.rows.length }} Data Rows
                </v-chip>
                <v-chip
                  size="small"
                  :color="isMandatorySatisfied ? 'success' : 'warning'"
                  variant="flat"
                >
                  <v-icon start :icon="isMandatorySatisfied ? 'mdi-check-circle' : 'mdi-alert'" />
                  {{ mandatoryStatusText }}
                </v-chip>
              </div>
              <div class="d-flex ga-2">
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-auto-fix"
                  @click="runAutoMap"
                >
                  Auto-Map
                </v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-broom"
                  @click="clearMapping"
                >
                  Clear
                </v-btn>
              </div>
            </div>
          </v-card>

          <!-- Column Mapping Accordion / Panels -->
          <div class="mb-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <h3 class="text-subtitle-1 font-weight-bold d-flex align-center">
                <v-icon start color="primary" icon="mdi-swap-horizontal-bold" />
                Variable to Column Mapping
              </h3>
              <span class="text-caption text-medium-emphasis">
                Map each variable to a column from your CSV file
              </span>
            </div>

            <!-- Mandatory Fields Section -->
            <v-card variant="outlined" class="mb-3">
              <v-card-item class="bg-red-lighten-5 py-2">
                <div class="d-flex align-center justify-space-between">
                  <div class="font-weight-bold text-red-darken-3 d-flex align-center">
                    <v-icon icon="mdi-asterisk" size="small" color="red" class="me-1" />
                    Mandatory Variables ({{ mandatoryMappedCount }}/{{ mandatoryFields.length }} mapped)
                  </div>
                  <v-chip
                    size="x-small"
                    :color="isMandatorySatisfied ? 'success' : 'error'"
                    variant="flat"
                  >
                    {{ isMandatorySatisfied ? 'All Mapped' : 'Required for Import' }}
                  </v-chip>
                </div>
              </v-card-item>
              <v-divider />
              <v-card-text class="pa-3">
                <v-row dense>
                  <v-col
                    v-for="field in mandatoryFields"
                    :key="field.key"
                    cols="12"
                    md="6"
                  >
                    <v-sheet class="pa-2 rounded border bg-background mb-2">
                      <div class="d-flex align-center justify-space-between mb-1">
                        <div class="d-flex align-center">
                          <span class="font-weight-bold text-body-2">{{ field.label }}</span>
                          <span class="text-red ms-1 font-weight-bold">*</span>
                          <v-chip size="x-small" variant="text" class="text-caption text-disabled ms-1">
                            ({{ field.type }})
                          </v-chip>
                        </div>
                        <v-icon
                          size="small"
                          :color="columnMapping[field.key] ? 'success' : 'red'"
                          :icon="columnMapping[field.key] ? 'mdi-check-circle' : 'mdi-alert-circle'"
                        />
                      </div>
                      <div v-if="field.description" class="text-caption text-medium-emphasis mb-1 text-truncate">
                        {{ field.description }}
                      </div>
                      <v-select
                        v-model="columnMapping[field.key]"
                        :items="csvHeaderSelectOptions"
                        item-title="title"
                        item-value="value"
                        label="Map to CSV Column"
                        density="compact"
                        variant="outlined"
                        hide-details
                        clearable
                      >
                        <template #item="{ props: itemProps, item }">
                          <v-list-item v-bind="itemProps" :subtitle="(item as any).preview || (item as any).raw?.preview" />
                        </template>
                      </v-select>
                    </v-sheet>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <!-- Non-Mandatory Fields Section (Collapsible) -->
            <v-expansion-panels v-model="optionalPanel" variant="accordion">
              <v-expansion-panel value="optional">
                <v-expansion-panel-title class="py-2">
                  <div class="d-flex align-center justify-space-between w-100 me-3">
                    <div class="font-weight-medium text-body-2 d-flex align-center">
                      <v-icon icon="mdi-information-outline" size="small" class="me-1 text-medium-emphasis" />
                      Optional Variables ({{ optionalMappedCount }}/{{ optionalFields.length }} mapped)
                    </div>
                    <v-chip size="x-small" variant="tonal" color="secondary">
                      Optional
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text class="pt-2">
                  <v-row dense>
                    <v-col
                      v-for="field in optionalFields"
                      :key="field.key"
                      cols="12"
                      md="6"
                    >
                      <v-sheet class="pa-2 rounded border bg-background mb-2">
                        <div class="d-flex align-center justify-space-between mb-1">
                          <div class="d-flex align-center">
                            <span class="font-weight-medium text-body-2">{{ field.label }}</span>
                            <v-chip size="x-small" variant="text" class="text-caption text-disabled ms-1">
                              ({{ field.type }})
                            </v-chip>
                          </div>
                          <v-icon
                            v-if="columnMapping[field.key]"
                            size="small"
                            color="success"
                            icon="mdi-check-circle"
                          />
                        </div>
                        <div v-if="field.description" class="text-caption text-medium-emphasis mb-1 text-truncate">
                          {{ field.description }}
                        </div>
                        <v-select
                          v-model="columnMapping[field.key]"
                          :items="csvHeaderSelectOptions"
                          item-title="title"
                          item-value="value"
                          label="Map to CSV Column"
                          density="compact"
                          variant="outlined"
                          hide-details
                          clearable
                        >
                          <template #item="{ props: itemProps, item }">
                            <v-list-item v-bind="itemProps" :subtitle="(item as any).preview || (item as any).raw?.preview" />
                          </template>
                        </v-select>
                      </v-sheet>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </div>

          <!-- Section 3: Data Preview Table -->
          <div class="mb-2">
            <div class="d-flex align-center justify-space-between mb-2">
              <h3 class="text-subtitle-1 font-weight-bold d-flex align-center">
                <v-icon start color="primary" icon="mdi-eye-outline" />
                Data Preview (First {{ previewRows.length }} rows)
              </h3>
              <v-btn-toggle v-model="previewMode" density="compact" mandatory color="primary" variant="outlined">
                <v-btn value="mapped" size="small">Mapped Entities</v-btn>
                <v-btn value="raw" size="small">Raw CSV</v-btn>
              </v-btn-toggle>
            </div>

            <!-- Mapped Preview -->
            <v-table v-if="previewMode === 'mapped'" density="compact" hover class="border rounded">
              <thead>
                <tr>
                  <th v-for="field in previewTableFields" :key="field.key" class="text-left">
                    {{ field.label }}
                    <span v-if="field.required" class="text-red">*</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in previewMappedEntities" :key="idx">
                  <td v-for="field in previewTableFields" :key="field.key">
                    <span v-if="formatPreviewCell(row, field.key)">
                      {{ formatPreviewCell(row, field.key) }}
                    </span>
                    <span v-else class="text-medium-emphasis text-caption">-</span>
                  </td>
                </tr>
                <tr v-if="previewMappedEntities.length === 0">
                  <td :colspan="previewTableFields.length" class="text-center text-medium-emphasis pa-4">
                    Map columns above to see transformed preview data
                  </td>
                </tr>
              </tbody>
            </v-table>

            <!-- Raw CSV Preview -->
            <v-table v-else density="compact" hover class="border rounded">
              <thead>
                <tr>
                  <th v-for="h in parsedCsv.headers" :key="h" class="text-left">
                    {{ h }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in previewRows" :key="idx">
                  <td v-for="h in parsedCsv.headers" :key="h">
                    {{ row[h] || '-' }}
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </template>
      </v-card-text>

      <v-divider />

      <!-- Dialog Actions -->
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="isImporting"
          @click="closeDialog"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-file-import"
          :loading="isImporting"
          :disabled="!canImport"
          @click="executeImport"
        >
          Import {{ parsedCsv?.rows.length ? `(${parsedCsv.rows.length} ${currentConfig.entityName}s)` : '' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ImportType, ColumnMapping } from '@/types/csvImport'
import { IMPORT_CONFIGS, autoMapColumns } from '@/utils/csvSchemas'
import { parseCsv, type ParsedCsv } from '@/utils/csvParser'
import { useCsvImport } from '@/composables/useCsvImport'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    initialType?: ImportType
    allowedTypes?: ImportType[]
  }>(),
  {
    initialType: 'rooms',
    allowedTypes: undefined,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'imported', payload: { type: ImportType; count: number; items: any[] }): void
}>()

const { isImporting, saveImportedData } = useCsvImport()

const selectedType = ref<ImportType>(props.initialType)
const inputTab = ref<'file' | 'paste'>('file')
const isDragging = ref(false)
const hasHeader = ref(true)
const fileName = ref('')
const rawCsvText = ref('')
const parsedCsv = ref<ParsedCsv | null>(null)
const columnMapping = ref<ColumnMapping>({})
const optionalPanel = ref<string | null>(null)
const previewMode = ref<'mapped' | 'raw'>('mapped')
const fieldsOverviewMode = ref<'compact' | 'detailed'>('compact')
const errorMessage = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement>()

// Watch initialType prop when dialog opens
watch(
  () => props.initialType,
  newType => {
    if (newType) {
      selectedType.value = newType
      resetMappingForCurrentType()
    }
  },
  { immediate: true }
)

watch(
  () => props.modelValue,
  isOpen => {
    if (isOpen) {
      selectedType.value = props.initialType || 'rooms'
      errorMessage.value = null
      if (rawCsvText.value) {
        parseAndApply(rawCsvText.value)
      }
    } else {
      resetState()
    }
  }
)

const currentConfig = computed(() => {
  return IMPORT_CONFIGS[selectedType.value] || IMPORT_CONFIGS.rooms
})

const availableTypeOptions = computed(() => {
  const all = Object.values(IMPORT_CONFIGS)
  const filtered = props.allowedTypes
    ? all.filter(c => props.allowedTypes!.includes(c.type))
    : all

  return filtered.map(c => ({
    title: c.label,
    value: c.type,
    subtitle: c.description,
    icon: c.icon,
  }))
})

const mandatoryFields = computed(() => {
  return currentConfig.value.fields.filter(f => f.required)
})

const optionalFields = computed(() => {
  return currentConfig.value.fields.filter(f => !f.required)
})

const mandatoryMappedCount = computed(() => {
  return mandatoryFields.value.filter(f => !!columnMapping.value[f.key]).length
})

const optionalMappedCount = computed(() => {
  return optionalFields.value.filter(f => !!columnMapping.value[f.key]).length
})

const isMandatorySatisfied = computed(() => {
  return mandatoryFields.value.every(f => !!columnMapping.value[f.key])
})

const mandatoryStatusText = computed(() => {
  if (isMandatorySatisfied.value) {
    return 'All mandatory variables mapped'
  }
  const missing = mandatoryFields.value.length - mandatoryMappedCount.value
  return `${missing} mandatory variable${missing > 1 ? 's' : ''} unmapped`
})

const csvHeaderSelectOptions = computed(() => {
  if (!parsedCsv.value) return []
  const options = [{ title: '(None / Do not import)', value: null as any, preview: 'Will be skipped' }]
  for (const header of parsedCsv.value.headers) {
    const sampleVal = parsedCsv.value.rows[0]?.[header] ?? ''
    const preview = sampleVal ? `Sample: "${sampleVal.length > 30 ? sampleVal.substring(0, 30) + '...' : sampleVal}"` : 'Empty in row 1'
    options.push({
      title: header,
      value: header,
      preview,
    })
  }
  return options
})

const previewRows = computed(() => {
  if (!parsedCsv.value) return []
  return parsedCsv.value.rows.slice(0, 5)
})

const previewTableFields = computed(() => {
  // Show all mandatory fields plus any mapped optional fields
  return currentConfig.value.fields.filter(f => f.required || !!columnMapping.value[f.key])
})

const previewMappedEntities = computed(() => {
  if (!parsedCsv.value || previewRows.value.length === 0) return []
  const mappedRows = transformCsvRowsWithMapping(previewRows.value)
  return currentConfig.value.transform(mappedRows)
})

const canImport = computed(() => {
  return (
    !!parsedCsv.value &&
    parsedCsv.value.rows.length > 0 &&
    isMandatorySatisfied.value &&
    !isImporting.value
  )
})

function handleTypeChange() {
  resetMappingForCurrentType()
}

function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = e => {
    const text = (e.target?.result as string) || ''
    rawCsvText.value = text
    parseAndApply(text)
  }
  reader.readAsText(file)
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = e => {
    const text = (e.target?.result as string) || ''
    rawCsvText.value = text
    parseAndApply(text)
  }
  reader.readAsText(file)
}

function handlePasteInput() {
  fileName.value = 'Pasted Text'
  parseAndApply(rawCsvText.value)
}

function reparseCsv() {
  if (rawCsvText.value) {
    parseAndApply(rawCsvText.value)
  }
}

function parseAndApply(text: string) {
  errorMessage.value = null
  if (!text || !text.trim()) {
    parsedCsv.value = null
    columnMapping.value = {}
    return
  }
  try {
    const result = parseCsv(text, { hasHeader: hasHeader.value })
    if (result.headers.length === 0) {
      errorMessage.value = 'Could not detect any columns in CSV'
      parsedCsv.value = null
      return
    }
    parsedCsv.value = result
    runAutoMap()
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to parse CSV'
    parsedCsv.value = null
  }
}

function runAutoMap() {
  if (!parsedCsv.value) return
  columnMapping.value = autoMapColumns(parsedCsv.value.headers, currentConfig.value.fields)
}

function clearMapping() {
  const empty: ColumnMapping = {}
  for (const field of currentConfig.value.fields) {
    empty[field.key] = null
  }
  columnMapping.value = empty
}

function resetMappingForCurrentType() {
  if (parsedCsv.value) {
    runAutoMap()
  } else {
    columnMapping.value = {}
  }
}

function resetState() {
  fileName.value = ''
  rawCsvText.value = ''
  hasHeader.value = true
  parsedCsv.value = null
  columnMapping.value = {}
  errorMessage.value = null
  isDragging.value = false
  fieldsOverviewMode.value = 'compact'
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function closeDialog() {
  emit('update:modelValue', false)
}

function transformCsvRowsWithMapping(rows: Record<string, string>[]): Record<string, any>[] {
  return rows.map(csvRow => {
    const obj: Record<string, any> = {}
    for (const field of currentConfig.value.fields) {
      const csvHeader = columnMapping.value[field.key]
      if (csvHeader && csvRow[csvHeader] !== undefined) {
        obj[field.key] = csvRow[csvHeader]
      } else if (field.defaultValue !== undefined) {
        obj[field.key] = field.defaultValue
      }
    }
    return obj
  })
}

function formatPreviewCell(row: any, key: string): string {
  if (!row) return ''
  // Support nested lookups e.g. accessibility.step_free_access
  const parts = key.split('_')
  let val = row[key]
  if (val === undefined) {
    if (key === 'accessibility_step_free_access') val = row.accessibility?.step_free_access
    else if (key.startsWith('layout_')) val = row.layout?.[parts.slice(1).join('_')]
    else if (key.startsWith('equipment_')) val = row.equipment?.[parts.slice(1).join('_')]
    else if (key.startsWith('connectivity_')) val = row.connectivity?.[parts.slice(1).join('_')]
  }

  if (typeof val === 'boolean') return val ? 'Yes (true)' : 'No (false)'
  if (val === null || val === undefined || val === '') return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

async function executeImport() {
  if (!parsedCsv.value || !canImport.value) return
  errorMessage.value = null

  try {
    // 1. Transform all CSV rows using user's column mapping
    const mappedRows = transformCsvRowsWithMapping(parsedCsv.value.rows)
    // 2. Convert to typed domain entities
    const entities = currentConfig.value.transform(mappedRows)
    // 3. Save to database / local store
    const count = await saveImportedData(selectedType.value, entities)

    emit('imported', {
      type: selectedType.value,
      count,
      items: entities,
    })

    closeDialog()
  } catch (err: any) {
    errorMessage.value = err.message || 'An error occurred during import'
  }
}
</script>

<style scoped>
.csv-dropzone {
  border-width: 2px;
  transition: all 0.2s ease-in-out;
}
.csv-dropzone:hover {
  border-color: #1976d2;
  background-color: rgba(25, 118, 210, 0.05);
}
</style>
