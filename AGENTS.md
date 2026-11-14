# Folio Engineering Standards (Ultracite + Biome)

This repository uses **Ultracite** and **Biome** for formatting, linting, and strict TypeScript discipline.

## Rules
- Never use `any` or `@ts-ignore` — model all external, imported, and IndexedDB payloads with strict interfaces and runtime type guards.
- Keep pure domain logic (search, link graph analysis, diffing, task bucketing, format conversion, integrity audits) decoupled from React components under `src/lib/`.
- Every interactive control must have a real working handler and accessible name (`aria-label` or visible label).
- Never transmit user data externally; all storage, OCR, PDF rendering, and file conversions execute locally on-device.
- Run `npm run check`, `npm run lint`, and `npm test` before committing (enforced via `lefthook.yml`).
