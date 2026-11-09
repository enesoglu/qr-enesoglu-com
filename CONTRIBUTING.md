# Contributing

Bug reports and focused pull requests are welcome. Search existing issues first and describe the expected behavior, actual behavior and steps to reproduce. Use synthetic QR content; do not include passwords or personal contact details in reports.

Follow the setup in [README.md](README.md) and the conventions in [AGENTS.md](AGENTS.md). Keep content processing entirely in the browser, use English in the UI and keep changes focused.

Create a feature branch and use Conventional Commits. Before opening a pull request, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. Run `pnpm e2e` for browser-facing changes and include relevant screenshots or reproduction steps.
