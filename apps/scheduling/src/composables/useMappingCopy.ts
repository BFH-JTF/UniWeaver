import { computed, ref } from 'vue'
import type { MappingPairPatch } from '@uniweaver/shared'
import { buildCopyPairDiff } from '@/utils/mappingQuickEntry'

/**
 * "Copy mapping from another entity"-Flow des Mapping-Editors: Quelle
 * wählen → Bestätigungs-Dialog → Diff anwenden (Replace-Semantik). Die
 * reine Diff-Berechnung liegt in utils/mappingQuickEntry.ts und ist
 * unit-testbar.
 */
export function useMappingCopy(options: {
  mode: () => 'lecturer' | 'module'
  targetId: () => string
  /** Display name of the currently selected source (for labels). */
  sourceName: () => string
  byLecturer: () => Map<string, string[]>
  byModule: () => Map<string, string[]>
  applyDiff: (label: string, diff: MappingPairPatch[]) => Promise<boolean>
  notify: (text: string, color: string) => void
}) {
  const copyFromId = ref<string | null>(null)
  const copying = ref(false)
  const copyConfirmOpen = ref(false)

  /** Display name of the currently selected source, reactive for the dialog. */
  const copySourceName = computed(() => options.sourceName())

  /** Pair count of the currently selected source, reactive for the dialog. */
  const copySourceCount = computed(() => {
    const id = copyFromId.value
    if (!id) return 0
    return options.mode() === 'lecturer'
      ? (options.byLecturer().get(id) ?? []).length
      : (options.byModule().get(id) ?? []).length
  })

  function confirmCopy(): void {
    if (!copyFromId.value || !options.targetId()) return
    copyConfirmOpen.value = true
  }

  async function executeCopy(): Promise<void> {
    if (!options.targetId() || !copyFromId.value) return
    copying.value = true
    try {
      const diff = buildCopyPairDiff({
        mode: options.mode,
        targetId: options.targetId,
        sourceId: () => copyFromId.value,
        byLecturer: options.byLecturer,
        byModule: options.byModule,
      })
      const ok = await options.applyDiff(`Copy from ${copySourceName.value}`, diff)
      copyConfirmOpen.value = false
      if (ok) {
        options.notify(`Replaced with ${diff.filter(d => d.value === 1).length} entries from ${copySourceName.value}`, 'success')
        copyFromId.value = null
      }
    } finally {
      copying.value = false
    }
  }

  return {
    copyFromId,
    copying,
    copyConfirmOpen,
    copySourceCount,
    copySourceName,
    confirmCopy,
    executeCopy,
  }
}