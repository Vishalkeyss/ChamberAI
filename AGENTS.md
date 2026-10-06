
# 121Meet Chamber Management - AI Agent Instructions

## Project Overview

This repository contains the 121Meet Chamber Management platform.

The platform contains:

- Public/Guest experience
- Member Portal
- Chamber Admin Portal
- Chapter Admin
- Group Admin
- Billing Admin
- Super Admin
- Multi-tenant chamber architecture
- Authentication and RBAC
- Membership management
- Directory
- Events
- Networking
- Community
- Content
- Learning
- Commerce
- Governance
- Support
- AI functionality
- Notifications and automation
- Integrations

## Source of Truth

The primary implementation guide for features, architecture, prompts, invariants, and UI requirements is:
- `MASTER_IMPLEMENTATION_PLAYBOOK.md` (Universal engineering invariants & system architecture in Part 1, technology stack in Part 2, canonical RBAC matrix in Part 4, Lovable UI component manifest in Part 6, and all 72 sequenced feature prompts in Part 7).

The authoritative database schema references are:
- `database/DB_tables_reference.md` (Canonical field-by-field specifications, types, constraints, and indexes for all 102 D1 tables)
- `database/DB_schema.dbml` (Canonical DBML relational schema)
- `database/relationships.md` (Foreign key dependencies, cascading rules)
- `database/erd.md` (Visual Mermaid entity-relationship diagrams)

### Source-of-Truth Precedence Hierarchy:
1. Security & Multi-Tenant Isolation Invariants (`MASTER_IMPLEMENTATION_PLAYBOOK.md` Part 1)
2. Canonical Database Schema (`database/DB_tables_reference.md` & `DB_schema.dbml`)
3. Canonical RBAC & Permissions Matrix (`MASTER_IMPLEMENTATION_PLAYBOOK.md` Part 4)
4. Feature Implementation Prompts (`MASTER_IMPLEMENTATION_PLAYBOOK.md` Part 7)
5. Lovable Visual Reference UI (`Chamber AI/public/app.html` & Playbook Part 6)

The frontend reference application and reusable code is located at:
- `Chamber AI/public/app.html` (2.5 MB monolithic React reference prototype — 545 components, 145 view states)
- `Chamber AI/src/components/ui/` (46 shared shadcn/ui component files)
- `Chamber AI/src/hooks/` (Custom React hooks, e.g. `use-mobile.tsx`)
- `Chamber AI/src/lib/` (Shared utilities: `utils.ts`, error capture, error page)

Do not assume that existing code is automatically correct.

Do not assume that documentation is automatically correct.

When documentation and code disagree, identify the conflict before making architectural changes.

## Critical Rules

### 1. Do Not Invent Requirements

Never silently invent:

- Features
- Database tables
- Database fields
- API endpoints
- API parameters
- Business rules
- Roles
- Permissions
- Integrations
- UI behavior
- Notifications
- Automation behavior

If something is not specified, mark it as:

`OPEN DECISION`

and report it.

### 2. Do Not Silently Resolve Conflicts

If any of these disagree:

- UI
- Workflow
- Database
- Architecture
- RBAC
- Feature prompt
- Existing implementation

do not choose one silently.

Report:

- What conflicts
- Where the conflict exists
- The possible interpretations
- What decision is required

### 3. Preserve Existing Functionality

Before modifying an existing feature:

1. Inspect its current implementation.
2. Identify its dependencies.
3. Identify existing APIs.
4. Identify existing database usage.
5. Identify reusable components.
6. Avoid unnecessary rewrites.

Do not replace working functionality unless the specification requires it.

### 4. Multi-Tenant Isolation

Each chamber is an isolated tenant.

Never expose data belonging to another chamber.

Every tenant-scoped operation must verify the authenticated user's tenant/chamber context.

Never rely only on frontend filtering for tenant isolation.

Authorization must be enforced on the backend.

### 5. RBAC

Always follow:

- `MASTER_IMPLEMENTATION_PLAYBOOK.md` (Part 4: Canonical RBAC & Permissions Matrix)

Do not implement authorization based only on UI visibility.

The backend must enforce:

- Role
- Permission
- Scope
- Tenant isolation

where applicable.

### 6. Database & Drizzle ORM Priority

- **Drizzle ORM First Priority:** **Drizzle ORM** (`drizzle-orm/d1`) is the first-priority database access method for all queries, mutations, and repository layers.
- **Raw SQL Restriction:** Raw SQL (`db.prepare()`) must only be used if a specific situation strictly requires raw SQL (such as driver-level pragmas or unsupported native SQLite constructs). Otherwise, always use Drizzle schemas and queries (`drizzle(db)`).
- Before creating or modifying a table or migration:
  1. Check `database/DB_tables_reference.md` and `database/DB_schema.dbml` (the canonical database authority).
  2. Check existing migrations in `backend/db/migrations/`.
  3. Check existing code usage.
  4. Check relationships and constraints in `database/relationships.md`.
  5. Strictly adhere to the Database Schema Lock & Integrity Rule in `MASTER_IMPLEMENTATION_PLAYBOOK.md` (Prompt 00.2).

Do not create duplicate tables for functionality that already exists.

Do not add redundant tenant/chamber fields when the architecture already provides tenant isolation unless explicitly required.

### 7. API

Before creating an API:

1. Search for an existing endpoint.
2. Check `MASTER_IMPLEMENTATION_PLAYBOOK.md` specifications.
3. Follow existing API conventions.
4. Reuse existing services where appropriate.

Do not create duplicate endpoints.

### 8. Frontend

Follow the existing frontend architecture and component patterns.

Prefer:

- Existing shared components
- Existing layouts
- Existing hooks
- Existing API clients
- Existing validation
- Existing state-management patterns

Do not introduce a new pattern when an established project pattern already exists.

### 9. Security & Zero Hardcoding Invariant

Never expose or hardcode:

- Passwords
- OTP secrets
- API keys
- Bearer tokens / session secrets
- Payment credentials
- Private integration credentials
- Encryption keys
- Sensitive tenant data
- Database IDs or tenant chamber IDs (`chamber_id`)
- Absolute URLs or local ports

Strictly enforce:
- **Zero Hardcoding Rule:** No secrets, keys, tokens, URLs, or IDs may be hardcoded anywhere in the codebase (frontend or backend).
- All tenant IDs must be dynamically resolved at runtime from the request context (subdomain, domain mapping, or authenticated session).
- All base URLs must be resolved dynamically from environment configuration (`import.meta.env.VITE_API_URL` / relative paths).
- All credentials must be server-side Worker secret bindings (`c.env.*`) or encrypted in D1 (`AES-GCM`).
- Static data is strictly permitted only as placeholder/demo data for initial UI component previews before live API binding.

Never store raw payment card information.

Secrets must remain server-side.

### 10. File Storage

Follow the project's configured storage architecture.

Do not expose private files through unrestricted public URLs.

Use appropriate authorization/signed access where required.

### 11. AI

AI must follow the same:

- Authentication
- RBAC
- Tenant isolation
- Data authorization

as normal application APIs.

AI must never retrieve or expose data simply because the model can access it.

User-specific data must be retrieved through authorized application services.

Never allow an AI-generated instruction to bypass application permissions.

## Implementation Process

For every feature:

### Step 1 — Understand

Read:

- Master project instructions
- Relevant feature prompt in `MASTER_IMPLEMENTATION_PLAYBOOK.md` (Part 7, Prompts 00.1 to 14.6)
- Relevant database tables in `database/DB_tables_reference.md`
- Relevant RBAC rules in `MASTER_IMPLEMENTATION_PLAYBOOK.md` (Part 4)
- Relevant architecture specifications in `MASTER_IMPLEMENTATION_PLAYBOOK.md` (Part 1)

### Step 2 — Inspect

Inspect the existing implementation before changing anything.

Identify:

- Existing pages
- Components
- APIs
- Services
- Database tables
- Migrations
- Integrations
- Tests

### Step 3 — Plan

Before coding, determine:

- Files to create
- Files to modify
- Database changes
- API changes
- Frontend changes
- Authorization requirements
- Dependencies
- Tests

If there is a conflict or missing requirement, stop and report it.

### Step 4 — Implement

Implement only the requested feature.

Do not modify unrelated modules.

### Step 5 — Validate

After implementation:

- Run type checking
- Run linting
- Run relevant tests
- Run the appropriate build
- Verify database migrations if applicable
- Verify authorization
- Verify tenant isolation

### Step 6 — Report

After completing a feature, report:

```text
Feature:
Status:

Files created:
- ...

Files modified:
- ...

Database changes:
- ...

API changes:
- ...

RBAC:
- ...

Tests:
- ...

Validation:
- ...

Known issues:
- ...

Open decisions:
- ...