import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Worktree checkouts live under .claude/worktrees — skip them so each
    // worktree's `npm test` only runs its own tests, not its siblings'.
    exclude: ['node_modules', 'dist', '.output', '.claude/**'],
  },
})
