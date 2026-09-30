const TOOL_DEV_PORTS: Record<string, number> = {
  administration: 5174,
  scheduling: 5175,
  competencies: 5176,
}

export function toolUrl(tool: string): string {
  if (import.meta.env.DEV) {
    const port = TOOL_DEV_PORTS[tool]
    return port ? `http://localhost:${port}/${tool}/` : `/${tool}/`
  }
  return `${window.location.origin}/${tool}/`
}

export function userEntryUrl(): string {
  const fromEnv = import.meta.env.USER_ENTRY_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (import.meta.env.DEV) return 'http://localhost:5173/user_entry'
  return `${window.location.origin}/user_entry`
}