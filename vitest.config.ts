import { defineConfig } from 'vitest/config'

// Global test options; per-workspace specifics live in vitest.workspace.ts.
// Coverage targets the logic-carrying modules ("Kernlogik"), not Vite entry
// files or Vue components.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'backend/src/lib/**',
        'apps/*/src/utils/**',
        'packages/shared/src/api.ts',
        'packages/shared/src/toolAuth.ts',
        'packages/shared/src/restrictions.ts',
        'packages/shared/src/restrictionSolver.ts',
      ],
    },
  },
})