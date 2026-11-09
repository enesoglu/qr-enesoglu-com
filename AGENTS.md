# Contributor guide

QR Generator is a minimal, ad-free QR code generator that runs entirely in the browser. It has no backend, accounts, tracking, or cookies.

## Start and finish

- Read `.agent/progress.md` when present, `git log --oneline -15`, and `git status` before working.
- Finish and commit uncommitted changes when they match the task marked `<- NEXT`; otherwise stash them and record the stash in the notes. Never silently discard changes.
- Re-run the last completed check, then continue from `<- NEXT`.
- Keep working notes in `.agent/progress.md`, gitignored and local to each worktree. After every commit update Status (current task, branch, last commit), Tasks (checkboxes with `<- NEXT`), Decisions, Open questions, and Known issues.
- At a natural break or near a usage limit, finish the current sub-task, commit, push the branch, update notes, and stop cleanly.
- Stay within the requested scope; record additional ideas under Known issues.

## Commands

Use Node from `.nvmrc` and pnpm via Corepack. Run `corepack enable` once when setting up the toolchain, then `pnpm install --frozen-lockfile`.

| Command           | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `pnpm dev`        | Start the development server                  |
| `pnpm build`      | Type-check and build production assets        |
| `pnpm preview`    | Serve the production build                    |
| `pnpm test`       | Run unit and component tests once             |
| `pnpm test:watch` | Watch unit and component tests                |
| `pnpm e2e`        | Run Playwright tests (install Chromium first) |
| `pnpm lint`       | Run ESLint                                    |
| `pnpm typecheck`  | Check TypeScript projects                     |
| `pnpm format`     | Format source and documentation               |

## Layout and boundaries

- `src/core/types.ts`: authoritative shared contracts; consult before changing module interfaces.
- `src/core/defaults.ts`: default design; `payloads/`: encoding and validation; `render/`: matrix encoding and SVG; `export/`: rasterization and scanning; `batch/`: input parsing and ZIP.
- `src/app/`: React layout, state, and feature panels. `src/components/`: reusable UI primitives. `src/styles/`: CSS.
- `tests/e2e/`: browser tests. `docs/architecture.md`: data flow and module responsibilities.
- `.agent/`: ignored working notes and local tools. The Codex app manages worktrees; archive them through the app.

Keep `src/core` framework-free; ESLint forbids React imports there. Browser-only APIs belong only in `src/core/export/png.ts` and the browser wrapper in `src/core/export/scan.ts`; keep decoding and contrast math pure. Build tools and tests may use Node APIs, but application code must run entirely in the browser.

## Conventions

Use strict TypeScript, named exports, small pure functions in core, and no `any`. Place tests beside source as `*.test.ts` (`*.test.tsx` for components). Format with Prettier. Write original code and documentation; use English in the UI. Preserve privacy: all content processing stays on the device.

## Git workflow

- Keep `main` releasable; never commit directly to it.
- Use one branch per unit of work: `feat/`, `fix/`, `refactor/`, `test/`, `docs/`, `ci/`, or `chore/`.
- Use Conventional Commits in English with an imperative subject of at most 72 characters. Explain the why in the body when it is not obvious. Make one logical change per commit.
- Never mention plans, phases, waves, sessions, prompts, or AI in commits, PRs, code, or docs. Do not manually add attribution trailers; leave tool defaults alone.
- Before opening a PR, pass `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Push the branch and open a PR using `gh pr create`. Use a Conventional Commit title and plain Summary / Changes / Testing sections.
- Wait for CI using `gh pr checks --watch`. Before merging, `git fetch`; if `origin/main` moved, rebase onto it, repeat checks, and push with `git push --force-with-lease` to your own feature branch only.
- Merge with `gh pr merge --merge --delete-branch`. Never force-push or rewrite `main`.
