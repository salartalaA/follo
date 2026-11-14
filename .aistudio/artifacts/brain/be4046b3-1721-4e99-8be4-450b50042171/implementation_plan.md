# Folio — Local-First Personal Knowledge & Productivity Workspace

Folio is an offline-first desktop web workspace that unifies rich document writing, interconnected knowledge management, task planning, structured collections, document inspection, and portable local backups entirely on the user's device.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Design Synthesis & Naming Confirmed**: Because no visual reference screenshots were attached and workspace naming was skipped, this plan synthesizes the confirmed design inspirations (**Notion**, **Craft**, **Obsidian**, **Anytype**, **Linear**, and **Raycast**) under the working name **Folio**. All persistence, search, OCR, document rendering, and import/export run strictly on-device in IndexedDB and Web Workers with zero external network transmission.

- **Confirmed Design Direction**: Extract the strongest interaction patterns from Notion (hierarchical sidebar & organization), Craft (editorial document surface & typography), Obsidian (bidirectional `[[wikilinks]]`, backlinks, and force-directed knowledge graph), Anytype (local-first object & structured collections), Linear (keyboard-first task lists & focused triage), and Raycast (`Cmd/Ctrl+K` command palette & global quick capture).
- **Default Workspace Identity**: **Folio** (with switchable independent local workspaces: Personal, Work, Study, Projects).
- **Browser & Local-Only Constraints**: Clipboard history uses user-initiated browser Clipboard API reads (`navigator.clipboard.readText()` / `read()`) rather than silent background polling; local OCR and PDF/DOCX/XLSX processing run in client-side Web Workers/libraries and explicitly report unsupported/encrypted files rather than faking results.

---

## 1. Overview & Core Concept

- **What It Does**: Folio gives individuals a single private, offline-capable studio to capture fleeting thoughts into a Universal Inbox, write long-form rich documents, link notes into an interactive knowledge graph, track tasks and daily notes, inspect PDFs with highlights and local OCR, manage code snippets and attachments, query structured table collections, and export/back up their entire vault in standard formats.
- **Target Audience / Persona**: Knowledge workers, researchers, engineers, students, and writers who want Notion-like versatility and Obsidian-level data ownership without cloud lock-in, subscriptions, or latency.
- **Key Value**: Effortless capture (`Cmd/Ctrl+Shift+N` or Command Palette), fast local full-text search across every entity type, zero-latency IndexedDB persistence, and transparent data portability across Markdown, JSON, CSV, XLSX, HTML, DOCX, RTF, PDF, and ZIP archives.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **First Launch & Workspace Shell**: Opens immediately to a clean, populated local workspace (Personal) with curated sample notes, a Daily Note for today, inbox items, tasks, a structured reading/project collection, and a sample code snippet—all stored in IndexedDB so edits persist across reloads and offline sessions.
2. **Universal Inbox & Quick Capture**: Pressing `Cmd/Ctrl+K` opens the Raycast-style Command Palette for navigation, actions, and search; pressing `Cmd/Ctrl+Shift+I` (or clicking **Quick Capture**) opens a streamlined capture modal for text, ideas, links, tasks, code snippets, or dropped files/images. Captured items land in the Universal Inbox where one click converts them into a Note, Task, Bookmark, or Document attachment.
3. **Writing & Linking in the Document Studio**: Selecting or creating a note opens a spacious, Craft-inspired editor powered by Tiptap (headings, formatting, task checklists, tables, syntax-highlighted code blocks, embedded images, Markdown shortcuts/import/export, and `[[internal note links]]`). A contextual right-hand Inspector drawer reveals Backlinks, Related Notes, Document Outline, Writing Statistics, Focus/Reading Mode toggles, and Version History with visual side-by-side/inline diff comparison.
4. **Knowledge Graph, Smart Organization & Diagnostics**: Switching to **Knowledge Graph** renders an interactive canvas linking notes, tags, and orphans with pan/zoom/filter controls. **Smart Collections & Diagnostics** evaluate dynamic query rules and run real integrity checks (duplicate title/content detection, broken `[[wikilinks]]`, orphan notes, and storage health).
5. **Productivity & Daily Flow**: Dedicated **Tasks** (`Today`, `Upcoming`, `Overdue`, `Completed` views with subtasks, priorities, and deadlines), **Calendar & Daily Notes**, **Snippets & Bookmarks**, **PDF & OCR Reader** (local PDF rendering with annotations/highlights/extracted notes plus on-device OCR for images/scanned pages), and **Collections** (Anytype-style typed tables with customizable fields, sorting, and filtering).
6. **Import, Export & Recovery**: A dedicated **Vault & Portability** workspace view supports importing/exporting TXT, Markdown, HTML, PDF, DOCX, RTF, CSV, XLSX, JSON, and full workspace ZIP archives, plus selective restore and data integrity verification.

### Visual Identity & Theme

- **Aesthetic Direction**: Calm, tactile editorial desktop studio—inspired by Craft's crisp document paper, Notion's quiet tree navigation, and Linear's razor-sharp list density and keyboard ergonomics.
- **Color Palette & Mood**:
  - *60% Neutral Canvas*: Crisp warm-neutral paper (`#FAF9F7`) in Light Mode and deep graphite ink (`#111214`) in Dark Mode.
  - *30% Structural Surfaces*: Subtle sidebar and inspector surfaces (`#F3F2EE` / `#17181C`) with 1px hairline borders (`1px solid` neutral dividers, single-level elevation—no nested card sandwiches).
  - *10% Accent Budget*: Refined cobalt-indigo (`#3B5BDB` light / `#6E8BFF` dark) reserved strictly for active navigation indicators, primary CTAs, and focus rings, paired with explicit semantic states (emerald `#16A34A`, amber `#D97706`, crimson `#DC2626`) always accompanied by text or icons.
- **Typography & Hierarchy**:
  - *Display & UI Headings*: `Plus Jakarta Sans` (clean geometric editorial precision, `text-wrap: balance`, maximum 2 active weights: 400 and 600).
  - *Long-Form Body & Document Prose*: `DM Sans` with optional `Source Serif 4` reading-mode toggle (15px–16px, 1.65 line-height, 68ch comfortable reading measure).
  - *Code, Metrics & Timestamps*: `JetBrains Mono` with `font-variant-numeric: tabular-nums` across all tables, task dates, word counts, and version timestamps.
- **Component Styling & Layout**:
  - Three-pane adaptive desktop shell: Collapsible 256px left navigation sidebar (Workspace switcher, Quick Capture trigger, Inbox, Daily Note, Notebooks/Folder tree, Tasks, Collections, Graph, Vault Tools), spacious central canvas with a clean 3-zone top bar (contextual breadcrumbs + primary view action), and a toggleable 300px Inspector panel (Backlinks, Outline, Versions, Writing Stats).
  - Zero static pill badges on metadata (tags, dates, and counts render as clean unboxed inline text separated by `·`); interactive filter controls use crisp segmented buttons.
- **Interactive Feedback & Motion**: Micro-interactions under 180ms (`cubic-bezier(0.16, 1, 0.3, 1)`), subtle Motion transitions for command palette and drawer overlays, explicit empty/loading/error states, and non-intrusive offline/PWA install controls.

---

## 3. Key Product Decisions & Trade-Offs

- **Local Persistence Architecture**:
  - *Chosen Approach*: **Dexie (IndexedDB)** as the authoritative store for all workspaces, notes, blocks/HTML/Markdown, tasks, inbox items, bookmarks, code snippets, structured collections, PDF annotations, version snapshots, clipboard history, activity timeline, and binary file/attachment Blobs—paired with **Zustand + Zustand Persist** (`localStorage`) strictly for lightweight UI preferences (theme, active workspace ID, sidebar width/collapse, focus mode, saved filter presets).
  - *Why*: `localStorage` caps around 5 MB and cannot store binary PDFs, images, or large version histories reliably. IndexedDB handles hundreds of megabytes of local files and fast indexed queries offline.
  - *Alternatives Considered*: Pure `localStorage` (fails on attachments and large vaults) or a Node/SQLite backend (violates the strict local-only, zero-backend browser requirement).

- **Rich-Text Editor & Internal Linking**:
  - *Chosen Approach*: **Tiptap** (ProseMirror) with StarterKit, Tables, TaskList/TaskItem, CodeBlockLowlight, Image, Link, Placeholder, and a custom `[[Wikilink]]` suggestion/mention extension + Markdown roundtrip serializer.
  - *Why*: Provides a Craft/Notion-caliber block and inline editing experience while keeping document content structured for instant backlink indexing, word counts, outline extraction, and clean Markdown/HTML/DOCX/PDF export.

- **Document Parsing, OCR & Multi-Format Portability**:
  - *Chosen Approach*: Lazy-loaded client-side modules using mature offline-capable libraries (`pdfjs-dist` for PDF rendering and text extraction, `tesseract.js` / local worker for image & scanned-PDF OCR with bundled/cached language data fallback and honest offline notice if model weights haven't been cached yet, `jszip` for ZIP workspace archives, `xlsx` / SheetJS or lightweight OOXML builder for CSV/XLSX, `docx` + `mammoth` for DOCX export/import, and custom deterministic RTF/Markdown/HTML converters).
  - *Why*: Lazy-loading heavy document engines keeps initial app boot fast while giving real, verifiable file processing for every listed format without touching any remote server.

- **Code Quality & Tooling Discipline**:
  - *Chosen Approach*: Strict TypeScript (`noImplicitAny` / zero `any`), **Biome** configuration for formatting and linting, **Ultracite** ruleset/standards, **Lefthook** pre-commit hook configuration, decoupled pure logic modules tested via `node:test`, and `vite-plugin-pwa` for true offline asset caching and installability.

---

## 4. Technical Architecture & Data Strategy

### System & Component Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        PWA Shell & Offline Service Worker                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     Global Shortcuts & Command Palette                  │  │
│  │        (Cmd+K Search/Actions · Cmd+Shift+I Quick Capture Modal)        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────┬─────────────────────────────┬───────────────────────┐  │
│  │  Left Navigation │     Primary Viewport        │   Contextual Drawer   │  │
│  │  Sidebar (256px) │     (Lazy-Loaded Views)     │   Inspector (300px)   │  │
│  │                  │                             │                       │  │
│  │ • Workspace Sw.  │ • Rich Note Editor (Tiptap) │ • Backlinks & Links   │  │
│  │ • Universal Inbox│ • Knowledge Graph (Canvas)  │ • Document Outline    │  │
│  │ • Daily / Tasks  │ • Tasks & Calendar Planner  │ • Version Diff Viewer │  │
│  │ • Notebook Tree  │ • Structured Collections    │ • Writing Stats       │  │
│  │ • Smart Filters  │ • PDF Reader & Local OCR    │ • Activity Timeline   │  │
│  │ • Snippets/Files │ • Vault Import/Export/Check │                       │  │
│  └────────┬─────────┴──────────────┬──────────────┴───────────┬───────────┘  │
│           │                        │                          │              │
│           ▼                        ▼                          ▼              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                Application Services & Pure Logic Layer                  │  │
│  │  Search & Smart Query Engine · Link/Orphan/Duplicate Analyzer ·        │  │
│  │  Diff Engine · Format Converters (MD/HTML/DOCX/RTF/PDF/CSV/XLSX/ZIP)   │  │
│  └─────────────────────────────────┬──────────────────────────────────────┘  │
│                                    │                                         │
│           ┌────────────────────────┴────────────────────────┐                │
│           ▼                                                 ▼                │
│  ┌──────────────────────────┐                   ┌─────────────────────────┐  │
│  │   Zustand + Persist      │                   │   Dexie (IndexedDB)     │  │
│  │   UI State & Preferences │                   │   Primary Vault & Blobs │  │
│  └──────────────────────────┘                   └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Zustand UI Store (Persisted)**: Active workspace ID, active route/view, active document/collection/task ID, theme (`light` / `dark` / `system`), Focus Mode & Reading Mode toggles, sidebar & inspector open states, and saved search presets.
- **Dexie IndexedDB Schema**:
  - `workspaces`: Independent vaults (`Personal`, `Work`, `Study`, `Projects`) with metadata and icons.
  - `folders`: Nested notebook/folder hierarchy per workspace.
  - `notes`: Rich JSON/HTML/Markdown content, folder ID, tags, template origin, pinned/favorite/archived flags, extracted `[[wikilink]]` targets, word/character counts, timestamps.
  - `noteVersions`: Immutable document snapshots for version history and line/word visual diffing.
  - `inboxItems`: Unprocessed captures (`text`, `link`, `task`, `code`, `file`, `image`) awaiting triage or conversion.
  - `tasks`: Workspace-scoped tasks with subtasks, priority (`urgent`, `high`, `medium`, `low`), due date, reminder timestamp, completion state, and optional linked note ID.
  - `collections` & `collectionRows`: Custom schema definitions (text, number, select, date, checkbox, URL, relation) and typed row records.
  - `attachments`: Binary Blobs (`PDF`, images, documents) with MIME type, size, checksum, and extracted OCR/text cache.
  - `pdfAnnotations`: Highlights, page bookmarks, notes, and extracted excerpts keyed by attachment ID.
  - `snippets` & `bookmarks`: Syntax-tagged code snippets and local bookmarks with tags and descriptions.
  - `clipboardEntries`: User-initiated captured clipboard items stored locally.
  - `smartCollections` & `savedSearches`: Dynamic filter predicates evaluated against notes, tasks, bookmarks, and attachments.
  - `activityEvents`: Chronological personal activity timeline (created, edited, linked, completed, exported).

### Interactive Component & State Mapping

- **Global Command Palette & Quick Capture**: Keyboard listeners (`Cmd/Ctrl+K`, `Cmd/Ctrl+Shift+I`) open modal portals that run live full-text queries across Dexie tables or write directly to `inboxItems` with instant conversion handlers (`convertToNote`, `convertToTask`, `convertToBookmark`, `convertToSnippet`).
- **Tiptap Editor & Backlinks**: Edits debounce-save to Dexie `notes`, automatically re-parse `[[Note Title]]` references to update link indices, record periodic snapshots in `noteVersions`, and trigger live updates in the Inspector's Backlinks, Outline, and Writing Stats tabs.
- **Knowledge Graph & Diagnostics**: Pure graph-builder utilities transform notes, tags, and internal links into nodes/edges for an interactive HTML5 Canvas force-directed graph (click node to navigate, filter by workspace/orphans/tags) and power real-time duplicate, broken-link, and orphan-note diagnostics.
- **Tasks & Calendar**: Task mutations validate required titles, update subtasks/priorities/deadlines, compute `Today` / `Upcoming` / `Overdue` / `Completed` buckets purely, and trigger in-app reminder checks while open.
- **PDF Reader & OCR**: Loads binary PDFs from IndexedDB via `pdfjs-dist`, renders pages to canvas with zoom/page navigation, persists user highlights/bookmarks/extracted notes, and runs local OCR on images or rendered PDF pages with progress feedback and clear error reporting for unsupported/corrupted files.
- **Import / Export & Integrity Tools**: Pure serialization/deserialization pipelines validate imported payloads with strict TypeScript guards before merging or restoring into Dexie, compute integrity check summaries (missing blobs, dangling folder/note references), and generate real downloadable files.

### Implementation Sequencing

1. **Phase 1 — Foundation & Shell**: Package installation, Biome/Ultracite/Lefthook setup, Tailwind v4 dual-theme tokens, Dexie database + deterministic seed data, Zustand UI store, three-pane responsive shell, PWA manifest & service worker setup.
2. **Phase 2 — Notes, Tiptap Editor & Organization**: Full rich-text editor, `[[wikilink]]` autocomplete, notebooks & nested folders, tags, pin/favorite/archive/duplicate/delete, and templates.
3. **Phase 3 — Universal Inbox, Quick Capture & Search**: Command Palette (`Cmd/Ctrl+K`), Quick Capture modal (`Cmd/Ctrl+Shift+I`), inbox-to-entity conversion, full-text search, saved searches, smart collections, and duplicate/broken-link/orphan diagnostics.
4. **Phase 4 — Productivity & Knowledge Management**: Tasks with subtasks/priorities/deadlines/reminders, Calendar & Daily Notes, Knowledge Graph canvas, Backlinks/Related Notes, multiple workspaces, Focus/Reading modes, writing stats, and activity timeline.
5. **Phase 5 — Advanced Document Tools**: Local attachment manager with previews, PDF reader with highlights/annotations/bookmarks/note extraction, local OCR, version history with visual diff comparison, user-initiated clipboard history, and syntax-highlighted code snippets + bookmarks.
6. **Phase 6 — Structured Collections, Import/Export & Recovery**: Anytype-style customizable collections (table view, sorting, filtering), full import/export across TXT, Markdown, HTML, PDF, DOCX, RTF, CSV, XLSX, JSON, and ZIP, workspace backup/selective restore, and integrity repair tools.
7. **Phase 7 — Verification, Testing & Polish**: Unit tests (`node:test` via `tsx`) for search, query evaluation, link/orphan/duplicate analysis, diffing, task filtering, and converters; Playwright headless browser verification across desktop & mobile viewports, Light/Dark themes, and offline PWA verification.
