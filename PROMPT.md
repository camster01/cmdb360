# CMDB360 — Creation Prompt

Use this prompt with Claude Code (or any capable coding assistant) to recreate
CMDB360 from scratch in a new directory.

---

## Prompt

Build a full-stack web application called **CMDB360** — a Configuration
Management Database with a 360° relationship view. Use the following tech stack
and implement all features described below.

---

### Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite
- Tailwind CSS (blue colour theme throughout — no teal/green)
- No external UI component library

**Backend**
- Node.js + Express + TypeScript (`ts-node-dev` for dev)
- PostgreSQL (via `pg` pool)
- JWT authentication (`jsonwebtoken` + `bcryptjs`)
- Port 3002 by default

**Tooling**
- Vite proxies `/api` to `http://localhost:3002`
- `docker-compose.yml` for Postgres + app
- `Dockerfile` for production build

---

### Data Model

```sql
users             (id, username, password_hash, role)          -- role: admin|contributor|viewer
systems           (id, name, description)                       -- multi-tenant
user_system_roles (user_id, system_id, role)                   -- contributor|viewer
dimensions        (id, system_id, name, subtitle, slot, visible) -- slot 0-8, visible bool
content_items     (id, dimension_id, code, description, details, urls jsonb,
                   org_node_id, order_number, created_at, updated_at)
relationships     (id, item1_id, item2_id)                     -- unique pair
org_nodes         (id, system_id, parent_id, name, description,
                   sort_order, children_label)                 -- self-referencing unlimited depth
org_config        (system_id, level_labels jsonb)              -- default level names per system
app_settings      (key, value)
```

All tables use idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE … ADD
COLUMN IF NOT EXISTS` migrations run on startup so the schema evolves safely.

---

### Authentication & Multi-Tenancy

- JWT stored in `localStorage` (`cmdb360_token`, `cmdb360_user`, `cmdb360_system`)
- Three global roles: `admin`, `contributor`, `viewer`
- System-scoped roles override global for contributors/viewers
- `X-System-ID` request header selects the active system
- Express middleware: `authenticate` → `resolveSystem` → `requireRole(...)`
- Admin has full access to all systems; others see only systems they're members of

---

### Frontend Architecture

```
src/
  types.ts              # TypeScript interfaces
  api.ts                # fetch wrapper (Bearer token + X-System-ID header)
  context/AppContext.tsx # global state: appData, orgData, currentUser, modals,
                         # focusedItemId, getOrgNodePath(), assignOrgNode()
  components/
    LoginScreen.tsx      # branded login form
    Header.tsx           # top bar: system switcher, Org / Stock / Admin / Logout
    Layout360.tsx        # three-column layout wrapper
    Center360.tsx        # centre column: focus selector + org breadcrumb
    DimensionPanel.tsx   # left/right dimension cards with related items
    OrgPage.tsx          # full-screen org tree (edit OR picker mode)
    StockEntryPage.tsx   # bulk stock entry grid
    modals/
      Modal.tsx
      ContentDetailModal.tsx   # view/edit CI + org assignment
      AddContentModal.tsx
      AddRelationshipModal.tsx
      SearchModal.tsx
      AdminPanel.tsx           # tabs: dimensions, users, systems, settings
      ChatModal.tsx            # streaming AI chatbot
  App.tsx
```

---

### The 360° View (core feature)

The main page is a **three-column layout**:

```
┌─────────────┬──────────────────┬─────────────┐
│ Dim 0       │  [System title]  │ Dim 4       │
│ Dim 1       │  [Org breadcrumb]│ Dim 5       │
│             │  Focus selector  │             │
│             │  (dimension +    │             │
│             │   entry ID drop) │             │
│ Dim 2       │  [Search]        │ Dim 6       │
│ Dim 3       │  [View/Edit]     │ Dim 7       │
│             │  [Add New]       │ Dim 8       │
└─────────────┴──────────────────┴─────────────┘
```

- Slot layout: slots 0-3 = left column top→bottom, slot 4 = top-centre, slots 5-8 = right column top→bottom
- When a CI is "focused" (centre selection), all dimension panels show items related to it
- Each panel item is clickable → sets it as the new focus
- The centre column shows an **org breadcrumb** (pin icon + path) above the selector when the focused CI has an org assignment
- Relationships are bidirectional (item1_id, item2_id unique pair)

---

### Org Hierarchy Page

Full-screen overlay opened via the **Org** header button.

**Two modes controlled by a toggle in the header:**

1. **Edit mode** (default for admin/contributor):
   - Recursive tree with depth-based icons (pin/house/chat/dot) and colours
   - Each node row hover shows: `[+ Child ✏] [Edit] [Delete]`
   - The `+ Child` label and the ✏ pencil are a split button — clicking the
     label adds a child, clicking ✏ renames what _that node's_ children are
     called (per-node `children_label` override, stored in DB)
   - Global level-label editor at top (Site → Building → Area → + level chips,
     click to rename, × to remove, dashed `+ level` to extend)
   - Save Label Changes button appears when labels are modified (admin only)
   - Unlimited depth via self-referencing `org_nodes` table

2. **Browse mode**:
   - Read-only tree showing item count badges (blue circle) on any node that
     has CIs assigned to it
   - Clicking a node expands it and shows an inline list of assigned CIs:
     `[DimensionName]  code  description` — clicking a CI focuses it on the
     main 360 page and navigates back
   - Hint: "Click any entry to make it the focus on the main page"

**Picker mode** (opened from ContentDetailModal or StockEntryPage):
- Separate `pickerMode` prop: `{ onPick: (node) => void; selectedId?: string }`
- Full-screen at `z-[60]` (above modal `z-50`)
- Header says "Select Org Location — Click a node to assign it"
- All rows are clickable; selected node highlighted; no edit controls shown
- ✕ Cancel button closes without selecting

---

### Content Items — Org Assignment

Every CI can be assigned to one org node at any level.

- `org_node_id` FK on `content_items` (nullable, `ON DELETE SET NULL`)
- **ContentDetailModal**: "Org Location" section at bottom of form
  - Shows breadcrumb path if assigned: `📍 Bloomington › S1 › Mfg Floor`
  - Assign / Change button opens org picker overlay (`z-[60]`)
  - Clear button removes the assignment
- **Center360**: when focused CI has an org assignment, show a compact
  frosted-white pill above the focus selector: `📍 Site › Building › Area`

---

### Stock Entry Page

Full-screen overlay opened via the **Stock** header button (contributors+ only).

**Layout:**
```
Header: [📦 Stock Entry — {location}]  [Save N Entries]  [← Back]

1. Setup
  Org Location *    [📍 Stock]  [Change]   Dimension Type *  [Computer ▾]
  Default Desc      [Dell Latitude 5420  ]   Default Order #  [PO-2025-001]

2. Entries                              3 of 3 rows have serial numbers
  #  │  Serial # *  │  Description  │  Order #   │  Note        │ ✕
  1  │  SN-LAP-001  │  Dell Lat…    │  PO-2025…  │              │ ✕
  2  │  SN-LAP-002  │  Dell Lat…    │  PO-2025…  │              │ ✕
  [+ Add Row]                           Tab from last cell to add a row
```

- Org location picker opens OrgPage in picker mode
- Selecting a dimension auto-fills Default Description with the dimension name
- Default Description and Default Order # auto-fill those columns on **new** rows only
- Grid starts with 3 blank rows; Tab from Note column of last row adds a new row
- Save runs all filled rows in parallel; per-row status: spinner → ✓ green / ✗ red
- "Clear N saved" button removes successfully saved rows from the grid
- `order_number` stored as a dedicated `VARCHAR(200)` column on `content_items`
- `details` = note field (free text)

---

### AI Chatbot

- Streaming SSE endpoint `POST /api/chat` — uses Anthropic Claude API
- `ANTHROPIC_API_KEY` from environment
- System prompt summarises current CMDB data (dimensions + item codes) for context
- ChatModal: full conversation history, streaming token-by-token display
- Triggered by a floating "CMDB360 Chatbot" button in the centre column

---

### Admin Panel

Four tabs (admin only):

| Tab | What it manages |
|-----|----------------|
| Dimensions | CRUD — name, subtitle, slot, visible toggle (Hide/Show) |
| Users | CRUD global users — username, role |
| Systems | CRUD systems, manage system members + roles |
| Settings | Key/value app settings (site title etc.) |

---

### Seed Data

On first run (no users), seed:
- 3 users: `admin/admin123`, `contributor/contrib123`, `viewer/view123`
- 1 default system: "D365 ERP Knowledgebase"
- 9 dimensions across slots 0-8
- ~14 sample content items across those dimensions
- ~13 sample relationships

---

### API Routes

```
POST   /api/auth/login               public
POST   /api/auth/logout

GET    /api/systems                  auth
POST   /api/systems                  admin
PUT    /api/systems/:id              admin
DELETE /api/systems/:id              admin
GET    /api/systems/:id/members      admin
PUT    /api/systems/:id/members/:uid admin
DELETE /api/systems/:id/members/:uid admin

GET    /api/dimensions               auth + system
POST   /api/dimensions               contributor+
PUT    /api/dimensions/:id           contributor+
DELETE /api/dimensions/:id           admin

GET    /api/items                    auth + system
POST   /api/items                    contributor+
PUT    /api/items/:id                contributor+
DELETE /api/items/:id                contributor+

GET    /api/relationships            auth + system
POST   /api/relationships            contributor+
DELETE /api/relationships/:id        contributor+

GET    /api/org                      auth + system  → { labels, tree }
PUT    /api/org/labels               admin
POST   /api/org/nodes                contributor+
PUT    /api/org/nodes/:id            contributor+
DELETE /api/org/nodes/:id            admin

GET    /api/users                    admin
POST   /api/users                    admin
PUT    /api/users/:id                admin
DELETE /api/users/:id                admin

GET    /api/settings                 admin
PUT    /api/settings/:key            admin

POST   /api/chat                     auth + system  → SSE stream
```

---

### Key Implementation Details

1. **`buildTree(flat, parentId)`** — recursive server-side function that turns
   flat `org_nodes` rows into a nested `{ children: TreeNode[] }` tree. Sort
   by `sort_order ASC`, then `name ASC`.

2. **`findOrgPath(nodes, id, path=[])`** — client-side recursive function in
   AppContext that returns the path from root to a given node ID as an array of
   `OrgNode[]`, used to render breadcrumbs.

3. **`updateNode / insertChild / removeNode`** — pure client-side tree
   helpers in OrgPage for optimistic UI updates without full reload.

4. **Per-node `children_label`**: each org node stores what its own children
   are called. Falls back to `labels[depth+1]` global label, then `'Child'`.
   The split `[+ Building][✏]` button: left half adds a child, right half edits
   the override label for that node. Indigo colour when a custom label is set.

5. **Org Browse mode**: append `?mode=browse` or use `useState('edit'|'browse')`
   toggle. In browse mode, after loading items, build a `Map<nodeId, ContentItem[]>`
   from items whose `org_node_id` is set. Show count badge + inline item list
   under each node.

6. **Stock Entry**: `readyCount = rows.filter(r => r.serial.trim() && r.status !== 'saved').length`.
   The Save button label shows this count. Rows save in `Promise.all()` with
   individual per-row status updates via `setRows` inside each `.then()`.

7. **`rowToItem(row)`** helper in items route maps snake_case DB columns to
   camelCase-ish frontend fields (`dimension_id → dimensionId` but
   `org_node_id` and `order_number` keep snake_case to match the DB directly).

---

### Environment Variables

```env
# server/.env
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cmdb360
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=change-this-in-production
ANTHROPIC_API_KEY=sk-ant-...   # optional, enables chatbot
```

---

### Reference Implementation

https://github.com/camster01/cmdb360
