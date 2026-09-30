import { ref } from 'vue'
import { usePostgres, EntityTables } from '@/composables/usePostgres'
import type { ProofOfCompetency } from '@/types/proofOfCompetency'

function emptyProofOfCompetency(): ProofOfCompetency {
  return {
    name: '',
    description: '',
    answerFormats: [],
    assignmentScope: 'individual',
    durationMinutes: undefined,
    competencyIds: [],
  }
}

export function useProofsOfCompetency() {
  const { fetchEntities, createEntity, updateEntity: updateDbEntity, removeEntity: removeDbEntity } = usePostgres()
  const proofsOfCompetency = ref<ProofOfCompetency[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProofsOfCompetency() {
    loading.value = true
    error.value = null
    try {
      proofsOfCompetency.value = await fetchEntities<ProofOfCompetency>(EntityTables.PROOF_OF_COMPETENCY)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addProofOfCompetency(proof: ProofOfCompetency) {
    error.value = null
    try {
      const saved = await createEntity<ProofOfCompetency>(EntityTables.PROOF_OF_COMPETENCY, proof)
      proof.id = saved.id
      proofsOfCompetency.value = await fetchEntities<ProofOfCompetency>(EntityTables.PROOF_OF_COMPETENCY)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function updateProofOfCompetency(proof: ProofOfCompetency) {
    const id = proof.id
    if (!id) return
    error.value = null
    try {
      await updateDbEntity(EntityTables.PROOF_OF_COMPETENCY, id, proof)
      const idx = proofsOfCompetency.value.findIndex(p => p.id === id)
      if (idx !== -1) proofsOfCompetency.value[idx] = proof
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function removeProofOfCompetency(id: string) {
    error.value = null
    try {
      await removeDbEntity(EntityTables.PROOF_OF_COMPETENCY, id)
      proofsOfCompetency.value = proofsOfCompetency.value.filter(p => p.id !== id)
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  async function importProofsOfCompetency(items: ProofOfCompetency[]): Promise<ProofOfCompetency[]> {
    error.value = null
    const imported: ProofOfCompetency[] = []
    try {
      for (const item of items) {
        const saved = await createEntity<ProofOfCompetency>(EntityTables.PROOF_OF_COMPETENCY, item)
        item.id = saved.id
        imported.push(item)
      }
      proofsOfCompetency.value = await fetchEntities<ProofOfCompetency>(EntityTables.PROOF_OF_COMPETENCY)
      return imported
    } catch (e: any) {
      error.value = e.message
      throw e
    }
  }

  return {
    proofsOfCompetency,
    loading,
    error,
    fetchProofsOfCompetency,
    addProofOfCompetency,
    updateProofOfCompetency,
    removeProofOfCompetency,
    importProofsOfCompetency,
    emptyProofOfCompetency,
  }
}