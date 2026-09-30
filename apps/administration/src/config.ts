export const APP_NAME = 'UniWeaver Administration'

export function userEntryUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:5173/user_entry'
  }
  // Production: all UniWeaver frontend apps are served from the same origin
  // by the backend, so the portal is always <origin>/user_entry.
  return `${window.location.origin}/user_entry`
}
