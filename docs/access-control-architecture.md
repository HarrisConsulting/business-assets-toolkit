# Access Control Architecture (Permission-First)

> **Status:** Proposed re-architecture.
> **Companion to:** [`access-control-policy-spec.md`](./access-control-policy-spec.md).
> **Relationship:** The policy spec captures the **why** (the role interview and the
> business intent). This document captures the **how** (the implementation-oriented
> architecture). Where the two differ, **this document supersedes** the policy spec,
> because the policy spec was authored type-first and later identified as architecturally
> inverted (see "Why This Re-Architecture Exists").

---

## Why This Re-Architecture Exists

The original `access-control-policy-spec.md` grew bottom-up from two concrete needs:

1. Stop Supplies users from approving their **own** orders.
2. Restrict the New School Connect (NSC App Admin) portal to assigned admin staff because
   of data sensitivity.

A general "portals + roles + employee types" framework was then retrofitted on top. The
result reasoned **type -> role -> permission** (employee type drives access). A structured
review surfaced that this inversion was the *root cause* of nearly every conflict in the
spec:

- `super_admin` had to be described as "not an employee type" yet still appeared as a row
  in every portal's role-mapping table.
- A "finance/admin leadership subgroup within `admin_staff`" was referenced repeatedly but
  never definable.
- Erroneous Staff Directory data (e.g., classroom teachers typed as `admin_staff`) could
  silently grant the wrong access.
- Each new portal felt like it required redesigning the access model.

**This document inverts the model to permission-first:** permissions are the atoms, roles
are bundles of permissions, and employee-type/portal defaults are merely a convenient
pre-assignment that can always be overridden per person. Under this model, the conflicts
above dissolve rather than needing special-case handling.

---

## Core Architectural Principles

1. **Permissions are the atoms.** The smallest unit of access is a single, action-level,
   portal-scoped permission (e.g., `supplies.order.approve`). Everything else is built from
   permissions.
2. **Roles are bundles of permissions — nothing more.** A role is a named, reusable set of
   permission IDs. Roles carry no logic, no scope, and no identity of their own.
3. **Roles are portal-self-contained.** Every role belongs to exactly one portal. The only
   exception is `super_admin_override`, which is the single cross-portal role. (There is no
   generic, cross-portal `viewer` role; each portal defines its own read role — see C-15.)
4. **Employee type grants nothing by itself.** Employee type is only an **input to default
   assignment**. It never directly confers access. (This finally satisfies the policy
   spec's Governance Rule #1 literally.)
5. **Defaults are a convenience, not authority.** The per-portal default matrix is a
   starting point. Per-person grants in Portal Access always win.
6. **The Staff Directory is the single source of identity.** Who someone *is*
   (employee type, unit, program/function) is edited in one place. The matrix *derives*
   what that means; it never silently redefines identity.
7. **Scope is resolved live, never frozen.** A user's order/visibility scope is intersected
   at resolution time from their current Staff Directory assignment, so role changes
   (e.g., teacher -> administration) take effect by editing the directory alone.
8. **Least privilege by default.** Default bundles contain the narrowest reasonable set of
   permissions. Elevated permissions are explicit, separately assignable, and auditable.
9. **High-risk controls are enforced at the database level; human-awareness alerts are
   emitted from the server layer.**
10. **Temporary and delegated grants expire** unless deliberately renewed.

---

## The Four-Layer Model

```
LAYER 1 — PERMISSIONS  (the atoms)
  Fine-grained, action-level, portal-scoped capabilities.
    supplies.order.create
    supplies.order.approve
    eds.payroll.edit
    nsc-app-admin.access.grant
    global.super_admin_override

LAYER 2 — ROLES  (named bundles of permissions)
  Reusable, portal-scoped. A role is ONLY a set of permission IDs.
    finance_approver         = { supplies.order.approve }
    confidential_hr_reviewer = { eds.record.view_confidential_notes }
    super_admin_override     = { global.super_admin_override }   <- the only cross-portal role

LAYER 3 — DEFAULT ASSIGNMENTS  (the initial-state matrix, per portal)
  "For portal P, employee_type T receives these roles by default."
  DEFINED in the Selection Matrix tab. A STARTING POINT, not authority.
    Supplies x teacher    -> program_requester
    EDS      x leadership -> executive_hr_admin
  (super_admin_override is NEVER a default in any matrix.)

LAYER 4 — ASSIGNMENTS & OVERRIDES  (per person, always wins)
  Managed in the Portal Access tab. Grant or revoke roles OR individual
  permissions per person, with expires_at + granted_by.
```

### Mapping to the User Access Control Panel tabs

The User Access Control Panel exposes the tabs this model needs:

| UI tab            | Layer | Responsibility |
|-------------------|-------|----------------|
| **Staff Directory** | Input | Source of identity: employee type, unit, program/function. |
| **Selection Matrix** | 3   | **Defines** each portal's permissions, roles, and `(portal x employee_type) -> default roles` initial state. The system-design tab, used once per portal. |
| **Quick Setup**   | 3 (applies) | **Applies** the matrix defaults to a single employee on demand (e.g., when a teacher becomes admin_staff). Reads the matrix; never redefines it. All portals are available here. |
| **Portal Access** | 4     | Per-person, per-permission grants & revocations that **override** defaults. |

> **Authority chain:** **Selection Matrix defines** the initial state -> **Quick Setup applies**
> it per user -> **Portal Access fine-tunes** per user/permission. The Selection Matrix is the
> single source of truth for what the defaults *are*; Quick Setup is a faithful applicator.

---

## Portal Lifecycle (de novo -> live)

Standing up a new portal (e.g., Employee Data System) follows four steps:

```
1. CREATE PORTAL
   Register the portal: stable identifier, case-sensitive display name,
   lifecycle_status (planned | active | read_only).

2. CONFIGURE IN SELECTION MATRIX TAB
   Define this portal's permission catalog, its roles (bundles of those
   permissions), and its employee_type -> default-role matrix (the INITIAL
   STATE for portal-wide permissions). One matrix per portal
   ("one portal, one matrix"). High-security portals (EDS, NSC App Admin)
   define narrow defaults (e.g., the self-service bundle); elevated roles are
   NOT defaulted.

3. SYSTEM AUTO-ASSIGNS DEFAULTS
   The resolution engine applies the Layer-3 initial state to employees by
   employee_type. This sets portal-wide starting permissions.

4. VIEW / UPDATE IN PORTAL ACCESS
   Admins view and adjust any individual's access for the selected portal
   (grant/revoke roles or single permissions, with expires_at + granted_by).
   Overrides always win.
```

**Quick Setup vs. Selection Matrix.** The Selection Matrix sets the *initial state* of
portal-wide permissions (done once per portal). Quick Setup applies those same defaults to a
*single user* on demand — for example, when an employee changes from `teacher` to
`admin_staff`, Quick Setup re-derives their correct defaults. **Therefore all portals —
including high-security EDS and NSC App Admin — must be available in Quick Setup.** Safety
comes from the matrix defining a *safe* default per employee_type (e.g., `admin_staff`'s EDS
default is the self-service bundle, **not** `general_hr_operator`), which Quick Setup then
faithfully applies. Quick Setup keeps any access a user already has.

---

## Resolution Algorithm

For a given `person` and `portal`, effective access is computed as:

```
effective_permissions(person, portal):

  1. START with the empty set.

  2. APPLY DEFAULTS (Layer 3):
       roles = default_matrix[portal][person.employee_type]
       permissions += union(role.permissions for role in roles)

  3. APPLY PER-PERSON OVERRIDES (Layer 4), in this order:
       permissions += granted role/permission overrides for (person, portal)
       permissions -= revoked role/permission overrides for (person, portal)
       (skip any override whose expires_at has passed)

  4. APPLY SUPER ADMIN (global):
       if person holds an active super_admin_override grant:
         permissions = ALL permissions across ALL portals

  5. RETURN permissions.

scope_filter(person):
  # Applied when a permission is exercised, not when it is granted.
  allowed_units_programs = union(person.assignments[].program_function)
  # e.g. supplies.order.create is auto-scoped to the requester's program(s).
  # School-wide permissions (e.g. supplies.order.approve) are not scope-filtered.
```

**Key properties**

- **Employee type only feeds Step 2.** It grants nothing on its own.
- **Overrides always win** (Steps 3-4 run after defaults).
- **Scope is intersected at exercise time** from the *current* directory assignment, so
  changing someone's unit/program in the Staff Directory immediately re-scopes them.
- **Wrong directory data produces a wrong *default*, never a locked-in grant.** Fix the
  data at the source (Staff Directory) or override the person (Portal Access); the matrix
  re-resolves automatically.

---

## Employee Types (identity inputs only)

These remain the workforce classifications, but they are now **only inputs to Layer 3**:

- `teacher`
- `admin_staff`
- `operations`
- `leadership`
- `contractor`
- `intern`

`super_admin` is **not** an employee type and never appears in the directory's type field.
It is represented exclusively as the `super_admin_override` **role** (Layer 2), grantable
only to `leadership`.

### Organizational scope model (Unit -> Program/Function)

Scope is a two-level hierarchy. The same schema field stores the child; the UI labels it
"Program" or "Function" depending on the unit.

| Unit            | Child term (UI label) | Examples                                   |
|-----------------|-----------------------|--------------------------------------------|
| Teaching        | Program               | `CH1`, `CH2`, `CH4`, `LE1`, `MAP`          |
| Administration  | Function              | `HR`, `Finance`, `Leadership`, `Admissions`|
| Operations      | Function              | `Security`, `Facilities`                   |

- A person may belong to **more than one** program/function (rare). Their scope is the
  **union** of all assignments.
- Order creation and program/team visibility are scoped at the **program/function** level
  (least privilege). Approval authority is **school-wide** (finance), not program-scoped.
- `support_programs[]` is a separate, assignable list for cross-program coverage
  (e.g., an app-support teacher serving an additional program). It supplements, but does
  not replace, the person's home assignment(s).

---

## Canonical Portal Names & Identifiers

Display names are **case-sensitive** front-end strings. The earlier identifiers `employees`
and `appadmin` were mutations and are **not** valid portal identifiers; use the canonical
values below.

| Display name (case-sensitive)          | Identifier / namespace | Lifecycle | Notes |
|----------------------------------------|------------------------|-----------|-------|
| **Supplies**                           | `supplies`             | active    | |
| **NSC App Admin**                      | `nsc-app-admin`        | active    | NSC = New School Connect; subrepo name; high-security. |
| **Employee Data System** (EDS)         | `eds`                  | active    | Acronym EDS acceptable; high-security. |
| **Events**                             | `events`               | planned   | Read-only until built. |
| **SIMS** (Student Information Management System) | `sims`        | planned   | TBD. |

Both acronym and long-form display names are acceptable; the long-form is the canonical
display name with the acronym/identifier shown alongside.

---

## Permission Catalog

Permissions are namespaced `portal.resource.action` (the portal segment is the canonical
identifier above). Each portal owns its own vocabulary; adding a portal means adding its
namespace, **not** changing the engine.

### `global.*` (cross-portal — super admin only)

| Permission                   | Description                                                        |
|------------------------------|--------------------------------------------------------------------|
| `global.super_admin_override`| Break-glass override granting all permissions across all portals.   |

### `supplies.*`

| Permission                       | Description                                              |
|----------------------------------|----------------------------------------------------------|
| `supplies.order.view_own`        | View one's own submitted orders.                         |
| `supplies.order.view_program`    | View orders within one's program/function scope.        |
| `supplies.order.create`          | Create a new order request.                              |
| `supplies.order.edit_own_draft`  | Edit one's own draft order.                              |
| `supplies.order.submit`          | Submit an order request.                                 |
| `supplies.order.mark_delivered`  | Mark an item delivered (within role scope).             |
| `supplies.order.deny`            | Deny an order request.                                   |
| `supplies.order.approve`         | Approve an order request (finance authority).           |
| `supplies.vendor.manage`         | Manage vendors.                                          |
| `supplies.vendor.manage_ops`     | Manage operations-scope vendors.                        |
| `supplies.budget.manage`         | Manage budget settings.                                  |

### `eds.*` (Employee Data System)

| Permission                          | Description                                              |
|-------------------------------------|----------------------------------------------------------|
| `eds.profile.view_own`              | View one's own profile.                                  |
| `eds.profile.edit_own`              | Edit one's own profile.                                  |
| `eds.pay.view_own`                  | View one's own pay-related info.                         |
| `eds.documents.upload_own`          | Upload documents to one's own record.                    |
| `eds.evaluations.view_own`          | View one's own evaluations / performance records.        |
| `eds.record.view_confidential_notes`| View confidential HR notes (any record).                |
| `eds.record.manage`                 | Manage normal employee records school-wide.             |
| `eds.documents.manage`              | Manage employee documents school-wide.                  |
| `eds.payroll.edit`                  | Edit payroll / tax / banking data.                      |

> **E-1 resolution:** There is **no** confidential-notes-on-own-record default grant.
> The vague `self_service_employee` catch-all is **deprecated** (see Migration Notes). An
> employee's default EDS access is composed of explicit own-record atoms
> (`eds.profile.*`, `eds.pay.view_own`, `eds.documents.upload_own`,
> `eds.evaluations.view_own`) and deliberately **excludes** confidential notes. Confidential
> notes remain a leadership-gated permission, grantable per person via Portal Access if a
> specific case ever warrants it.

### `nsc-app-admin.*` (NSC App Admin)

| Permission                                | Description                                                |
|-------------------------------------------|------------------------------------------------------------|
| `nsc-app-admin.support.operate`           | Perform support tasks (email changes, verification, etc.). |
| `nsc-app-admin.comms.broadcast`           | Send communications / broadcasts / messaging follow-up.    |
| `nsc-app-admin.operate`                   | Operate day-to-day App Admin areas.                        |
| `nsc-app-admin.access.grant`              | Grant / revoke App Admin access (access control).          |
| `nsc-app-admin.config`                    | System configuration (technical).                          |
| `nsc-app-admin.security`                  | Security settings (technical).                             |
| `nsc-app-admin.audit.integrity`           | Audit-log integrity controls (technical).                  |
| `nsc-app-admin.messaging.global_rules`    | Global messaging rules (technical).                        |
| `nsc-app-admin.override.tools`            | Technical override tools.                                   |

### Reserved namespaces (planned portals)

- `events.*` — Events portal (lifecycle: **planned**; read-only until built).
- `sims.*` — Student Information Management System (lifecycle: **planned/TBD**).
- Additional portals are added by registering a new namespace and matrix.

---

## Role Definitions (roles as permission bundles)

Every role below is a **named set of permission IDs**. Roles are portal-scoped except
`super_admin_override`. Per **C-15**, each portal defines its **own** read role (no generic
cross-portal `viewer`).

### Supplies

| Role                       | Permissions |
|----------------------------|-------------|
| `supplies_viewer`          | `supplies.order.view_own`, `supplies.order.view_program` |
| `program_requester`        | `supplies_viewer` + `supplies.order.create`, `supplies.order.edit_own_draft`, `supplies.order.submit`, `supplies.order.mark_delivered` |
| `teacher_proxy_requester`  | *Same as `program_requester`* (assigned with an expiration; scope limited to supported program) |
| `operations_requester`     | *Same as `program_requester`* + `supplies.vendor.manage_ops` |
| `portal_operations_manager`| All `program_requester` permissions + `supplies.order.deny`, `supplies.vendor.manage`, `supplies.budget.manage` |
| `finance_approver`         | `supplies.order.approve` |
| `portal_executive_override`| All standard Supplies permissions **except** that the role itself confers **no** self-approval bypass (see Separation of Duties) |

### EDS (Employee Data System)

| Role                       | Permissions |
|----------------------------|-------------|
| `eds_self_service`         | `eds.profile.view_own`, `eds.profile.edit_own`, `eds.pay.view_own`, `eds.documents.upload_own`, `eds.evaluations.view_own` — replaces deprecated `self_service_employee` |
| `general_hr_operator`      | `eds.record.manage`, `eds.documents.manage` |
| `confidential_hr_reviewer` | `eds.record.view_confidential_notes` |
| `executive_hr_admin`       | `eds_self_service` + `eds.record.manage`, `eds.documents.manage`, `eds.record.view_confidential_notes`, `eds.payroll.edit` |

### NSC App Admin

| Role                     | Permissions |
|--------------------------|-------------|
| `program_app_support`    | `nsc-app-admin.support.operate`, `nsc-app-admin.comms.broadcast` (scope: own + assigned support program) |
| `nsc_operations_admin`   | `nsc-app-admin.support.operate`, `nsc-app-admin.comms.broadcast`, `nsc-app-admin.operate` |
| `nsc_operations_delegate`| *Same as `nsc_operations_admin`* (assigned with an expiration) |
| `app_access_admin`       | All `nsc_operations_admin` permissions + `nsc-app-admin.access.grant` |

### Global

| Role                  | Permissions |
|-----------------------|-------------|
| `super_admin_override`| `global.super_admin_override` (resolves to **all** permissions across **all** portals). Leadership-only. **Break-glass — not a daily driver.** |

> **Deprecated:** `self_service_employee` (replaced by the explicit `eds_self_service`
> bundle) and any generic cross-portal `viewer` (replaced by portal-specific read roles such
> as `supplies_viewer`).

---

## Default Assignment Matrices (Layer 3 — the Selection Matrix initial state)

`super_admin_override` is **never** a default. It is granted only explicitly, only to
`leadership`, and only rarely.

### Supplies

| Employee type | Default role(s)                                             |
|---------------|-------------------------------------------------------------|
| `teacher`     | `program_requester`                                         |
| `admin_staff` | `portal_operations_manager`                                 |
| `operations`  | `operations_requester`                                      |
| `leadership`  | `portal_executive_override`                                 |
| `contractor`  | `program_requester`                                         |
| `intern`      | *none* (may receive `teacher_proxy_requester` if assigned)  |

> `finance_approver` is **not** a default for any type. It is an explicit per-person grant
> (Portal Access), held by members of the **Finance function** who are approved as approvers,
> plus `leadership` where appropriate. *(E-3 resolution: the "finance/admin leadership
> subgroup" is simply "people granted `finance_approver`," not a hidden subtype.)*

### EDS (Employee Data System)

| Employee type | Default role(s)                |
|---------------|--------------------------------|
| `teacher`     | `eds_self_service`             |
| `admin_staff` | `eds_self_service` (may add `general_hr_operator` per person) |
| `operations`  | `eds_self_service`             |
| `leadership`  | `executive_hr_admin`           |
| `contractor`  | `eds_self_service`             |
| `intern`      | `eds_self_service`             |

> **C-16 fix:** `admin_staff`'s EDS default is `eds_self_service` (own-record only) — **not**
> `general_hr_operator`. EDS remains available in Quick Setup, but Quick Setup applies this
> safe default; `general_hr_operator` is an explicit per-person grant only.

### NSC App Admin

| Employee type | Default role(s)                                            |
|---------------|------------------------------------------------------------|
| `teacher`     | *none* (may add `program_app_support` per person)          |
| `admin_staff` | *none* (may add `nsc_operations_admin` per person)         |
| `operations`  | *none*                                                     |
| `leadership`  | `app_access_admin`                                         |
| `contractor`  | *none*                                                     |
| `intern`      | *none* (may add `nsc_operations_delegate` per person)      |

### Events / SIMS (planned)

Registered with `lifecycle_status = planned` and **no** default access until built.

---

## Cross-Cutting Rules

### Separation of Duties (self-approval guardrail)

**Rule:** A user may not exercise `supplies.order.approve` on an order they created
(`approver_id != created_by`).

**Enforcement:** At the **database level** on the approval write / status transition to
approved. The application layer may also check this for clearer messaging, but the database
remains the final enforcement point. A `BEFORE INSERT/UPDATE` trigger is recommended over a
plain `CHECK` constraint because the exemption requires a lookup.

**Exemption (E-2 resolution, option b):** **Only `super_admin_override`** may bypass this
guardrail, and any such bypass is **audited and alerted** (break-glass). Notably:

- Leadership performing **routine** work uses normal Supplies roles and **cannot**
  self-approve.
- `portal_executive_override` **does not** itself grant a self-approval bypass. The role
  carries broad Supplies capability but **not** an exemption. This removes the former
  contradiction between the role note and the exception list.

### Break-Glass Alerting

Any exercise of `global.super_admin_override` (including a self-approval bypass) must:

1. Create an **audit record**, and
2. Emit a **passive alert** to the designated leadership/oversight group with who used it
   and when.

The alert is **non-blocking** (it must not impede a genuine emergency) and is emitted from
the **server layer** (human-awareness), while the audit record is written at the
**database level** (integrity). `super_admin_override` is a **break-glass** role: leadership
should use their normal portal roles day-to-day and reserve the override for emergencies.

### Time-Bound Access

Temporary and delegated grants support an optional `expires_at`:

- Applies especially to `intern`, `contractor`, `teacher_proxy_requester`,
  `nsc_operations_delegate`, `program_app_support`, and any temporary override.
- **E-5 resolution (option b — prompted, not mandatory):** The Portal Access screen
  **prompts for and warns** when an end date is omitted, but does **not** hard-block
  indefinite grants. "Indefinite should be the exception, not the default."
- `expires_at` is stored on the individual assignment record. Expired records remain for
  audit but are **ignored** by the resolution algorithm (Step 3) when computing live access.

### Audit Logging Baseline

Every change to person-specific portal access creates an audit record. Audit-on-write is
**database-enforced** so that **all** mutation paths — admin screen, system process, or
direct SQL — are captured (this closes the "when available" gap and satisfies Governance
Rule #11).

**Minimum payload:** actor, target, portal, access change (granted/updated/revoked/expired),
timestamp, source.
**Recommended additional fields:** previous value, new value, expiration date (if set/changed),
reason/notes (if the UI collects them).

**Applies at minimum to:** person-specific access changes, temporary-access expirations,
and `super_admin_override` assignments/revocations and uses.

---

## Data Model (recommended)

```
employee
  id
  employee_type        ENUM(teacher, admin_staff, operations, leadership, contractor, intern)

employee_assignment            -- handles rare multi-membership (union scope)
  employee_id  FK
  unit                 ENUM(Teaching, Administration, Operations, ...)
  program_function     TEXT     -- CH1 / HR / Finance / Security / ...

employee_support_program       -- separate assignable cross-program coverage list
  employee_id  FK
  program_function     TEXT

portal
  key                  TEXT PK  -- supplies / eds / nsc-app-admin / events / sims
  display_name         TEXT     -- case-sensitive (Supplies, NSC App Admin, Employee Data System, ...)
  lifecycle_status     ENUM(active, planned, read_only)

permission
  id                   TEXT PK  -- portal.resource.action  (e.g. supplies.order.approve)
  portal_key           FK       -- 'global' for cross-portal
  description          TEXT

role
  key                  TEXT PK
  portal_key           FK       -- 'global' only for super_admin_override

role_permission                -- roles are bundles of permissions
  role_key       FK
  permission_id  FK

portal_default_access_rule     -- Layer 3 (Selection Matrix tab; the initial state)
  portal_key     FK
  employee_type  ENUM
  role_key       FK

portal_access_assignment       -- Layer 4 (Portal Access tab; overrides defaults)
  employee_id    FK
  portal_key     FK
  role_key       FK NULL        -- grant a whole role, OR
  permission_id  FK NULL        -- grant/revoke a single permission
  effect         ENUM(grant, revoke)
  expires_at     TIMESTAMP NULL -- prompted for temp/delegated grants
  granted_by     FK             -- auditability

access_audit_log               -- DB-enforced on write
  actor_id
  target_id
  portal_key
  change_type    ENUM(granted, updated, revoked, expired, override_used)
  previous_value JSONB NULL
  new_value      JSONB NULL
  expires_at     TIMESTAMP NULL
  reason         TEXT NULL
  source         ENUM(admin_screen, system_process, direct_db)
  created_at     TIMESTAMP
```

---

## Migration Notes (from the type-first spec)

The two things that work today must be preserved:

1. **Supplies self-approval guardrail.** Re-expressed as
   `approver_id != created_by` on `supplies.order.approve`, enforced by a Postgres trigger,
   exempting only `super_admin_override` (alerted). No functional regression.
2. **New School Connect lockdown.** Re-expressed as: no employee type receives NSC App Admin
   access by default; `admin_staff` may be granted `nsc_operations_admin` per person;
   `leadership` defaults to `app_access_admin`. Sensitivity is preserved by keeping
   technical permissions (`nsc-app-admin.config/security/audit/messaging/override`) out of
   every non-super-admin role.

**Mechanical changes:**

- **Deprecate `self_service_employee`**; replace with the explicit `eds_self_service` bundle.
- **Deprecate any generic `viewer` role**; replace with portal-specific read roles
  (e.g., `supplies_viewer`). *(C-15)*
- **Remove `super_admin` from every role-mapping table**; represent it only as the
  `super_admin_override` role. The directory `type` field never contains `super_admin`.
- **Re-express each canonical role as a permission bundle** (see Role Definitions).
- **Rename portal identifiers** to canonical values: `eds` (Employee Data System),
  `nsc-app-admin` (NSC App Admin). The mutations `employees` and `appadmin` are retired.
  *(C-18)*
- **Fix erroneous directory data at the source** (e.g., classroom teachers mistyped as
  `admin_staff`): correct the Staff Directory `type`/assignment; the matrix then re-resolves
  correct defaults automatically. No per-portal manual permission edits required.

---

## Conflict-Resolution Ledger

This architecture was produced by reviewing `access-control-policy-spec.md` with the
"Analyze Long Coding Spec Documents" skill. Resolutions:

| Ref  | Issue                                                            | Resolution |
|------|-----------------------------------------------------------------|------------|
| C-13 | **(Root)** Architecture was type-first                          | Re-architected permission-first. |
| C-01 / E-1 | Confidential notes in default self-service                | `self_service_employee` deprecated; confidential notes excluded from defaults. |
| C-02 | `super_admin` as a pseudo-type                                  | Modeled as the `super_admin_override` role only; never a type or default. |
| C-03 / E-2 | `portal_executive_override` vs. self-approval exception   | Role confers no bypass; only `super_admin_override` (alerted) may bypass. |
| C-06 / E-3 | Undefined "finance/admin leadership subgroup"             | = holders of an explicit `finance_approver` grant; no subtype. |
| C-07 / E-4 | Undefined program/team/ops scope                          | Two-level `Unit -> Program/Function`; union for multi-membership; scope resolved live. |
| C-12 | Matrix vs. Staff Directory authority for type                  | Directory = identity source; matrix derives defaults; fix data at source. |
| C-14 | `super_admin_override` as sole cross-portal key                | Accepted; treated as break-glass with leadership-only + alert + review. |
| C-15 | Generic cross-portal `viewer` role in the UI                   | Replaced with portal-specific read roles (e.g., `supplies_viewer`); no generic `viewer`. |
| C-16 | Quick Setup auto-granted EDS `general_hr` to `admin_staff`     | EDS default for `admin_staff` corrected to `eds_self_service`; elevated roles are explicit per-person grants. |
| C-17 | Quick Setup vs. Selection Matrix overlap                       | Selection Matrix **defines** defaults; Quick Setup **applies** them per user; Portal Access fine-tunes. |
| C-18 | Portal naming inconsistency (`employees`/`appadmin`)           | Canonical identifiers `eds` and `nsc-app-admin`; case-sensitive display names; mutations retired. |
| E-5  | Mandatory vs. prompted `expires_at`                            | Prompted + warned, not hard-blocked. |
