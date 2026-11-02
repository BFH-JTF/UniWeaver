import { computed, ref } from 'vue'
import { ApiRequestError, type EntityReferenceFinding } from '@uniweaver/shared'
import { isReferencesBody, severityTitle } from '@/utils/deleteRefs'
import { usePostgres } from '@/composables/usePostgres'

export type DeletableKind =
  | 'curriculum'
  | 'department'
  | 'program'
  | 'degree'
  | 'module'
  | 'class'
  | 'semester'
  | 'version'

const DELETE_COLLECTIONS: Record<DeletableKind, string> = {
  curriculum: 'curriculums',
  department: 'departments',
  program: 'programs',
  degree: 'degrees',
  module: 'modules',
  class: 'classes',
  semester: 'semesters',
  version: 'curriculum_versions',
}

/**
 * Shared UX of the delete-with-references dialog: opens the confirm dialog,
 * loads the current reference findings for the target entity, runs the
 * removal via the injected `executeDelete` (which owns the per-kind entity
 * composables and the success snackbar), and re-shows the findings when an
 * unexpected 409 (new references) happens between opening the dialog and
 * confirming deletion.
 */
export function useDeleteWithReferences(options: {
  /** Performs the actual removal for one kind (view-side switch). */
  executeDelete: (kind: DeletableKind, id: string, confirmRef: boolean) => Promise<void>
  /** Success snackbar per kind, called after a successful removal. */
  notifyDeleted: (kind: DeletableKind) => void
  /** Generic snackbar (error level). */
  notify: (message: string, color?: 'success' | 'error' | 'warning') => void
}) {
  const { fetchReferences } = usePostgres()

  const deleteDialogOpen = ref(false)
  const deleteTargetName = ref('')
  const deleteReferences = ref<EntityReferenceFinding[]>([])
  const deleteRefsLoading = ref(false)
  const deleteConfirmChecked = ref(false)
  let deleteKind: DeletableKind = 'department'
  let deleteId = ''

  const deleteBlockingRefs = computed(() => deleteReferences.value.filter(r => r.severity !== 'cleanup'))
  const deleteNeedsConfirm = computed(() => deleteBlockingRefs.value.length > 0)

  async function openDeleteDialog(kind: DeletableKind, id: string, name: string) {
    deleteKind = kind
    deleteId = id
    deleteTargetName.value = name
    deleteReferences.value = []
    deleteConfirmChecked.value = false
    deleteDialogOpen.value = true
    const collection = DELETE_COLLECTIONS[kind]
    if (!collection || !id) return
    deleteRefsLoading.value = true
    try {
      const refs = await fetchReferences(collection as Parameters<typeof fetchReferences>[0], id)
      deleteReferences.value = refs.references
    } catch {
      deleteReferences.value = []
    } finally {
      deleteRefsLoading.value = false
    }
  }

  async function handleDelete() {
    const confirmRef = deleteBlockingRefs.value.length > 0
    try {
      await options.executeDelete(deleteKind, deleteId, confirmRef)
      options.notifyDeleted(deleteKind)
      deleteDialogOpen.value = false
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409 && isReferencesBody(err.body)) {
        // A reference appeared between opening the dialog and deleting; show it.
        deleteReferences.value = err.body.references
        deleteConfirmChecked.value = false
        options.notify('Deletion blocked: new references were found. Please review and confirm again.', 'error')
      } else {
        options.notify('Deletion failed', 'error')
        deleteDialogOpen.value = false
      }
    }
  }

  return {
    deleteDialogOpen,
    deleteTargetName,
    deleteReferences,
    deleteRefsLoading,
    deleteConfirmChecked,
    deleteBlockingRefs,
    deleteNeedsConfirm,
    severityTitle,
    openDeleteDialog,
    handleDelete,
  }
}