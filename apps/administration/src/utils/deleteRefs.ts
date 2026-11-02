import type { EntityReferenceFinding } from '@uniweaver/shared'

/** Human title for one reference finding inside the delete dialog. */
export function severityTitle(ref: EntityReferenceFinding): string {
  if (ref.severity === 'cascade') return `Will also be deleted: ${ref.label}`
  if (ref.severity === 'breaks') return `Referenced by: ${ref.label} — references will be cleaned`
  return `Will be cleaned up: ${ref.label}`
}

/** Type guard: an ApiRequestError body that carries reference findings. */
export function isReferencesBody(body: unknown): body is { references: EntityReferenceFinding[] } {
  return !!body && typeof body === 'object' && Array.isArray((body as { references?: unknown }).references)
}