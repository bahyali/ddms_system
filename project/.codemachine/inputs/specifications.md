Below is a **user‑journey map** plus a **UI blueprint** (wireframes + component specs) for the Dynamic Data Management System (DDMS). It’s written so a design/engineering team—or an AI agent—can build the experience as described.

---

## 0) Product framing (for the journeys)

* **Personas**

  * **Tenant Admin** — sets up entity types, fields, permissions, and governance.
  * **Builder/Power User** — configures validation, dependencies, computed fields, imports/exports.
  * **Contributor** — creates/edits records, manages relationships, runs searches, bulk updates.
  * **Viewer** — reads data and audit history.

* **Primary entities (sample)**

  * Users, Projects, Resources.

* **North-star UX**

  * Create or change a field in under 2 minutes with confidence.
  * Find any record in < 500 ms p95 with server‑powered filters.
  * Clear, actionable validation in forms and bulk operations.

---

## 1) Information architecture (IA)

```
Global Nav
├── Data
│   ├── [EntityType] List (e.g., Projects)
│   │    └── Record Detail
│   ├── Users
│   └── Resources
├── Build
│   ├── Entity Types
│   │    └── [EntityType] → Fields
│   ├── Field Library (all fields across types)
│   └── Permissions (roles, per-field ACL)
├── Operations
│   ├── Imports / Exports
│   ├── Bulk Edits
│   └── Indexes (status)
├── Audit
│   ├── Activity Log
│   └── Record Versions
└── Settings
    ├── Tenant
    └── API Access
```

---

## 2) End‑to‑end experience map (service blueprint)

> **Stages:** Discover → Configure → Populate → Relate → Explore → Maintain → Govern
> Each stage lists *Frontstage (UI)*, *Backstage (system)*, *KPIs*, *Risks/mitigations*.

### 2.1 Discover (first‑time use)

* **Frontstage (UI)**

  * Welcome screen → “Create your first entity type” CTA.
  * Quickstart wizard with three templates: Users, Projects, Resources.
  * Empty states explain purpose with sample screenshots.
* **Backstage**

  * Seed sample entity types & fields.
  * Cache field metadata (LRU 30s).
* **KPIs**

  * Time‑to‑first‑entity‑type < 2 min; wizard completion rate > 80%.
* **Risks / Mitigations**

  * Overwhelm → keep templates focused; show “edit later”.

### 2.2 Configure (add fields)

* **Frontstage**

  * **Build → Entity Types → [Project] → Fields** screen:

    * Fields table with **Add Field** primary CTA.
    * Add Field modal: key, label, kind, rules, options, ACL, “index this field”.
    * Live preview panel of the form layout.
* **Backstage**

  * Create field_def; if `indexed=true`, kick off `CREATE INDEX CONCURRENTLY`; enqueue status poll.
* **KPIs**

  * Field creation success p95 < 2 s; validation errors < 5% on first attempt.
* **Risks**

  * Mis‑typing keys → slug helper + uniqueness check.

### 2.3 Populate (create/edit records)

* **Frontstage**

  * **Data → Projects → Create**:

    * Dynamic form from field_defs (TanStack Form).
    * Inline validation + top error summary; relation pickers.
  * **Record Detail**:

    * Header with primary actions (Edit, Duplicate, Delete).
    * Tabs: Details, Relationships, History.
* **Backstage**

  * Zod schema compile → validate → insert; FTS trigger; versioning trigger.
* **KPIs**

  * Form submit success rate > 95%; p95 API < 200 ms.
* **Risks**

  * Conflicting edits → optimistic concurrency; surface version mismatch.

### 2.4 Relate (link records)

* **Frontstage**

  * In **Record Detail → Relationships tab**:

    * Relation section per relation field.
    * “Add link” opens searchable picker (server search + debounce).
* **Backstage**

  * Insert into edges; relation type trigger validates target type; SSE notifies.
* **KPIs**

  * Relation picker search < 300 ms p95; linkage failure < 1%.
* **Risks**

  * Wrong target type → pre‑filter by target entity; show “Only Users can be owners”.

### 2.5 Explore (search, filter, table)

* **Frontstage**

  * **Data → Projects list**:

    * TanStack Table in server mode; filter builder (chips + condition groups).
    * Column chooser; saved views; export.
* **Backstage**

  * Filter DSL → SQL; FTS; JSONB/GIN; expression indexes for hot fields.
* **KPIs**

  * p95 simple < 100 ms; complex < 500 ms; scroll 60FPS with virtualization.
* **Risks**

  * Over‑broad queries → guardrails (limits, depth).

### 2.6 Maintain (bulk ops, imports/exports)

* **Frontstage**

  * **Bulk Edit** modal: choose fields to set; preview affected count.
  * **Import Wizard**: upload → map columns → validate → fix errors → apply.
* **Backstage**

  * Chunked updates; staging table; validation report; audit batching.
* **KPIs**

  * 1,000 updates < 5 s p95; import success rate > 90%.
* **Risks**

  * Partial failure → resume from failed rows.

### 2.7 Govern (permissions, audit, versions)

* **Frontstage**

  * **Permissions**: roles matrix; per‑field ACL viewer/editor.
  * **Audit**: filter by action/user/date; **Record Versions** with diff & restore.
* **Backstage**

  * RLS per tenant; per‑field ACL enforced; audit appends; versioning.
* **KPIs**

  * Access violations 0; restore success > 99%.
* **Risks**

  * Confusing ACLs → show “who can read/write” badges on fields.

---

## 3) User journey maps (persona‑specific)

### 3.1 Tenant Admin — “First Setup”

| Step | Goal                   | Action (UI)                                                     | System                            | Success signal                    | Errors & Recovery                    |
| ---- | ---------------------- | --------------------------------------------------------------- | --------------------------------- | --------------------------------- | ------------------------------------ |
| 1    | Understand app         | Land on Welcome                                                 | Serve templates                   | Clicks “Start with templates”     | N/A                                  |
| 2    | Create entity types    | Choose “Projects, Users, Resources”                             | Create types + defaults           | Confirmation toast                | Retry on network                     |
| 3    | Add fields to Projects | Add `status(select)`, `budget(number)`, `owner(relation->user)` | Create field_defs; index `budget` | Preview updates instantly         | Duplicate key → inline error         |
| 4    | Set permissions        | Open Permissions; set `budget` write=Admin                      | Save ACL                          | Field shows lock icon in form     | ACL conflict → show role explanation |
| 5    | Verify                 | Open Data → Projects form                                       | Fetch schema → render             | Sees required marks & constraints | Validation explains missing fields   |

### 3.2 Builder — “Evolve Schema Safely”

| Step | Goal               | Action                                | System                        | Success                     | Errors                            |
| ---- | ------------------ | ------------------------------------- | ----------------------------- | --------------------------- | --------------------------------- |
| 1    | Add computed field | Add `total_cost` formula              | Store formula; mark read‑only | Field shows calculator icon | Invalid formula → lint with hint  |
| 2    | Add dependency     | `deadline` requiredIf `status=Active` | Update validate rules         | Form toggles required live  | Conflicts → surface rule conflict |

### 3.3 Contributor — “Daily Work”

| Step | Goal             | Action                                  | System                      | Success                    | Errors                           |
| ---- | ---------------- | --------------------------------------- | --------------------------- | -------------------------- | -------------------------------- |
| 1    | Create a project | Fill form; pick owner                   | Validate; insert; version=1 | Toast “Project created”    | Validation explains fixes        |
| 2    | Link resources   | Relationships tab → “Add link”          | Edges insert + SSE          | Chip with resource appears | Wrong type blocked w/ message    |
| 3    | Filter & export  | Build filter; save view; export CSV     | DSL→SQL; stream CSV         | File download starts       | Rate limit → backoff hint        |
| 4    | Bulk close       | Select rows → Bulk Edit `status=Closed` | Chunk updates               | Progress 100%              | Partial failures → CSV of errors |

### 3.4 Viewer — “Audit & History”

| Step | Goal          | Action                         | System          | Success               | Errors |
| ---- | ------------- | ------------------------------ | --------------- | --------------------- | ------ |
| 1    | Check changes | Open Record → History tab      | Load versions   | Diff visible          | None   |
| 2    | Inspect audit | Audit page filter by user/time | Query audit_log | Timeline shows events | N/A    |

---

## 4) Wireframes (low‑fi, annotated)

> Textual wireframes include **zones** and **component notes**.

### 4.1 Entity Type → Fields (Builder)

```
+--------------------------------------------------------------------------------+
| Header: Build / Entity Types / Projects                          [ Help ] [ ? ]|
+--------------------------------------------------------------------------------+
| [Tabs] Fields | Permissions | JSON Schema                                      |
+--------------------------------------------------------------------------------+
| [Toolbar]  + Add Field   [Search fields...]   [Sort: Position▼]               |
+--------------------------------------------------------------------------------+
| Fields Table (TanStack)                                                         |
| ┌─────────┬─────────┬──────────┬───────────┬──────────┬──────────┬──────────┐ |
| | Label   | Key     | Kind     | Required  | Indexed  | ACL      | Actions  | |
| ├─────────┼─────────┼──────────┼───────────┼──────────┼──────────┼──────────┤ |
| | Status  | status  | Select   | ●         | ○        | RW:All   | Edit ⋮   | |
| | Budget  | budget  | Number   | ○         | ●        | R:All/W:A| Edit ⋮   | |
| | Owner   | owner   | Relation | ●(one)    | ○        | RW:All   | Edit ⋮   | |
| └─────────┴─────────┴──────────┴───────────┴──────────┴──────────┴──────────┘ |
+--------------------------------------------------------------------------------+
| Side Preview: "Create Project" form live preview (updates on field edits)      |
+--------------------------------------------------------------------------------+
```

**Notes**

* **Add Field Modal** steps:

  1. Basics (label, key, kind).
  2. Rules (required, unique, min/max, regex, enum).
  3. Relation (target type, cardinality) shown if kind=relation.
  4. Behavior (searchable, indexed, position, dependencies, formula).
  5. Permissions (read/write roles).

  * Primary button: **Create Field** (shows index creation status if chosen).

---

### 4.2 Record List (Contributor)

```
+--------------------------------------------------------------------------------+
| Header: Data / Projects                                [ New Project ]         |
+--------------------------------------------------------------------------------+
| [Saved View: All Projects ▼]   [ Save view ]   [ Reset ]   [ Export ▼ ]        |
| Filter Builder:                                                     [ Add + ]  |
|  [status is Active]  ⋯ [budget ≥ 10,000]  ⋯ [owner includes Alice] [FTS: "ai"] |
+--------------------------------------------------------------------------------+
| Table (TanStack, server mode, virtualized)                                     |
| ┌─────────────┬─────────┬──────────┬───────────┬─────────────┬──────────────┐ |
| | Name        | Status  | Budget   | Deadline  | Owner       | Updated      | |
| ├─────────────┼─────────┼──────────┼───────────┼─────────────┼──────────────┤ |
| | AI Roadmap  | Active  | 12,000   | 31 Oct    | Alice       | 2 min ago    | |
| | ...         | ...     | ...      | ...       | ...         | ...          | |
| └─────────────┴─────────┴──────────┴───────────┴─────────────┴──────────────┘ |
| Footer:  Rows 1–50 of 2,381   [ Prev ]  Page 5  [ Next ]   (Keyset cursor)    |
+--------------------------------------------------------------------------------+
| Bulk Actions: [ Edit ] [ Delete ] [ Export Selection ]                          |
+--------------------------------------------------------------------------------+
```

**Notes**

* Column chooser (gear icon) → toggle fields; drag to reorder; persist per saved view.
* Chips in Filter Builder are editable; clicking a chip opens its operator/value popover.
* Loading shows row skeletons; errors appear inline bar with “Try again”.

---

### 4.3 Create / Edit Record (Contributor)

```
+--------------------------------------------------------------------------------+
| Header: New Project                                      [ Save ] [ Cancel ]   |
+--------------------------------------------------------------------------------+
| Form (TanStack Form)                                                           |
| Name [__________]  (required)                                                  |
| Status [ Active ▾ ] (Select: Active, On Hold, Closed)                          |
| Budget [  12000 ] (Number; min=0; help: "USD")                                 |
| Deadline [ 2025-10-31 📅 ] (Date; requiredIf status=Active)                    |
| Owner [  Alice (search...) ] (Relation → User, single)                         |
| -- Section: Resources (Relation many) --                                       |
|   [ + Add Resource ]  shows searchable list (typeahead)                        |
+--------------------------------------------------------------------------------+
| Validation summary (if any):                                                   |
|  • deadline is required when status = "Active".                                |
+--------------------------------------------------------------------------------+
```

**Notes**

* Disabled inputs for computed fields; label shows a calculator icon + tooltip with formula.
* Dependent fields hide/show in real time; ARIA live region announces changes for screen readers.

---

### 4.4 Record Detail with Relationships & History

```
+--------------------------------------------------------------------------------+
| Header: AI Roadmap Q4          [ Edit ] [ Duplicate ] [ Delete ]               |
| Meta: Owner: Alice • Status: Active • Updated: 2 min ago • Version: 4         |
+--------------------------------------------------------------------------------+
| Tabs:  Details | Relationships | History                                       |
+--------------------------------------------------------------------------------+
| Details                                                                              |
|   Two-column layout with field/value cards.                                         |
+--------------------------------------------------------------------------------+
| Relationships                                                                        |
|   Owner (User, one)      Alice           [ Change ]                                  |
|   Resources (Resource, many)                                                        |
|     • MacBook Pro (Laptop)         [ Remove ]                                       |
|     • ...                                                                          |
|   [ + Add link ]  → opens relation picker modal.                                    |
+--------------------------------------------------------------------------------+
| History                                                                             |
|   Version timeline (right rail)                                                     |
|   v4 (now)                                                                          |
|   v3 — Edited by Bob, 10:14                                                        |
|   v2 — Created by Alice, 09:50                                                     |
|   [ Compare v4 ↔ v3 ] (diff view)  [ Restore v3 ]                                   |
+--------------------------------------------------------------------------------+
```

---

### 4.5 Bulk Edit Modal

```
+----------------------------------------------------+
| Bulk Edit (312 selected)                           |
+----------------------------------------------------+
| Choose fields to update: [ Status ▾ ] [ Budget ▾ ] |
| Status: [ Closed ▾ ]                                |
| (Optional) Budget: [ ______ ]                       |
| Preview: Will change 312 records.                   |
| [ Cancel ]                          [ Apply ]       |
+----------------------------------------------------+
```

* Shows estimate time; progress bar during execution; partial failure download (CSV of row errors) link.

---

### 4.6 Import Wizard

```
Step 1: Upload
  [ Drop CSV ]  or  [ Browse... ]

Step 2: Map columns
  CSV: name → field: Name
  CSV: owner_email → field: Owner (relation by email)
  CSV: budget → field: Budget

Step 3: Validate
  • Row 23: budget < 0 (min 0)
  • Row 71: owner not found (alice@...) → [Create user on the fly] [Skip row]

Step 4: Apply
  Summary: 998 ok, 2 failed → [ Download errors.csv ]
  [ Cancel ]             [ Import 998 records ]
```

---

## 5) Component specifications (build‑ready)

### 5.1 TanStack Table (server mode)

* **Inputs**

  * `columns`: derived from field_defs (`label`, `kind`, `sortable`, `accessorFn`).
  * `state`: sorting, filters, pagination cursor.
* **Behavior**

  * On state change, POST `/entities/:type/search` with Filter DSL + sort + cursor.
  * Virtualization for rows; skeletons for loading.
* **Renderers**

  * `text`: clamp 1 line + tooltip.
  * `number`: locale formatting.
  * `date`: humanized + title with ISO.
  * `select`: colored tokens by enum.
  * `boolean`: check icon + sr‑only label.
  * `relation`: pill with display field; hover shows mini‑card.

### 5.2 Filter Builder (chips + groups)

* **Model**

  * Group = { logic: and|or, items: (rule | group)[] }.
  * Rule = { field, operator, value }.
* **Operators (by kind)**

  * text: eq, neq, contains, startsWith, endsWith, fulltext
  * number/date: eq, neq, lt, lte, gt, gte, between
  * select/boolean: eq, neq, in, notIn
  * relation: related(toIds?), notRelated
* **UX**

  * Field dropdown shows kind and example values.
  * Value editor adapts (enum dropdown, datepicker, number input, relation picker).
  * “Test query” button shows result count fast (HEAD‑like endpoint).

### 5.3 TanStack Form (dynamic)

* **Construction**

  * Input components by kind; props from `validate` + `options`.
  * Conditional rules: `visibleIf`, `requiredIf` re‑evaluated on dependency change.
* **Validation**

  * Client Zod mirrors server; server re‑validates.
  * Show inline error under field; summary at top.
* **Accessibility**

  * `aria-describedby` for help/error; live region for validation summary.
  * Keyboard focus trapped in dialogs; ESC to close; tab order logical.

### 5.4 Relation Picker

* **UI**

  * Combobox (async); list with columns (Name, key fields).
  * “Create new target” inline (if role allows) spawns mini form.
* **API**

  * Search endpoint: `/entities/:target/search` with simple contains/fulltext.

### 5.5 Notifications & toasts

* **Success**: concise “Saved”, “Created link”, “Bulk updated 312”.
* **Error**: start with cause, then fix: “Budget must be ≥ 0 (you entered −10)”.
* **Undo**: where viable (delete link).

---

## 6) Visual design system (tokens)

* **Typography**: Inter (system fallback). Sizes: 12, 14, 16(base), 18, 20, 24, 32.
* **Spacing scale**: 4px grid (4, 8, 12, 16, 24, 32, 48).
* **Color tokens**

  * `--bg`: #0B0C0F (dark) or #FFFFFF (light).
  * `--text`: #111827 (light) / #E5E7EB (dark).
  * `--brand`: #2563EB; `--brand-contrast`: white.
  * Semantic: success #16A34A, warning #F59E0B, danger #DC2626, info #0EA5E9.
* **Components**

  * Buttons: primary (brand), secondary (neutral), subtle (ghost).
  * Inputs: outline focus ring brand; error ring danger.
  * Chips: enum colors auto‑assigned (hash on value).
  * Cards: subtle shadows; radius 8px.

---

## 7) States & edge cases

* **Loading**

  * Skeleton rows in tables; shimmer blocks in forms.
* **Empty**

  * Lists: “No Projects yet” + primary CTA.
  * Filter returns 0: “No results” with “Clear filters”.
* **Errors**

  * Inline bar above table & forms with details and retry.
  * Form field errors map to exact path; unknown keys flagged.
* **Concurrency**

  * On 409, modal shows “This record changed; review diff” → merge or overwrite.
* **Permissions**

  * Read‑only fields show lock icon; tooltip lists roles that can edit.

---

## 8) Mobile & responsive

* **List pages**

  * Collapse filters into a drawer; columns reduce to: Name, Status, Updated.
* **Forms**

  * Single column; sticky Save bar bottom.
* **Detail**

  * Tabs become segmented control; relationships as collapsible lists.

---

## 9) Content design (microcopy)

* **Empty state (Projects)**:
  “Projects organize your work. Add fields like Status, Budget, and Owner. Start with **New Project** or **Customize fields**.”
* **Validation**:
  “Budget must be 0 or higher.”
  “Deadline is required when Status is Active.”
* **Danger actions**:
  “Delete this project? This cannot be undone.” (checkbox confirm)

---

## 10) Acceptance checks (UX)

* Create a field from the Fields screen in ≤ 2 minutes with accurate validation.
* Create a project with owner relation; see it in list within 1 second.
* Build filter (status=Active, budget≥10000, FTS “roadmap”), results in < 500 ms p95.
* Bulk close 300 items in ≤ 5 seconds with progress feedback.
* Restore version N‑1 and see toast + updated view immediately.

---

## 11) Implementation hints (frontend wiring)

* **Routes**

  * `/data/:type` (list), `/data/:type/new`, `/data/:type/:id`
  * `/build/types`, `/build/types/:id/fields`, `/permissions`
  * `/ops/imports`, `/ops/bulk`, `/ops/indexes`
  * `/audit`, `/versions/:recordId`
* **State**

  * React Query caches metadata (`entity_types`, `field_defs`); invalidate on changes.
  * SSE from `/events` triggers precise query invalidation (record ID or entity type key).
* **Performance**

  * Server‑side pagination always; fetch 50–100 rows per page.
  * Debounce search inputs (250–400ms); cancel previous requests.

---

## 12) What to hand off to design/eng next

* This document → create Figma frames for the 6 wireframes above.
* Generate OpenAPI → SDK for UI.
* Build the **Field Registry** (components per kind) & **Filter Builder** first; they unlock most flows.
* Scaffold **List**, **Create/Edit**, **Detail** screens per entity type using metadata.

---

If you want, I can turn these wireframes into a **clickable mock (Markdown + HTML/CSS)** or export a **starter Figma JSON structure** that mirrors the components and layouts described.
