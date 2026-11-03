/** Normalise unknown thrown values into a human-readable message. */
export function errText(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string' && e) return e
  return ''
}
