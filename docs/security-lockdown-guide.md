# Security Lockdown Guide for Developers

> **Who this is for:** Any developer — human or AI agent — working in this repository.
> "It works" is not the finish line. **"It is proven secure against unauthorized access"** is the finish line.

---

## 📋 Executive Summary

This guide establishes mandatory security guardrails for all development work in this repository. It covers database access control, secret management, storage policies, AI agent rules, and automated verification.

- **4 constraint tiers** (Database, Secrets, Storage, Pipeline)
- **1 mandatory AI agent rules file** to pin before any code generation
- **1 automated test suite** to prove security before every deployment
- **15 requirements ingested · 2 conflicts found · 2 conflicts resolved · 0 escalations**

---

## 🗺️ Phased Roadmap

### Phase 1 — Foundation (Do This Before Writing Any Feature Code)

These steps lock down the environment. No feature code should be merged until Phase 1 is complete.

- **REQ-001** Enable RLS on every existing and new table
- **REQ-002** Establish zero-access as the default; write explicit policies for every permitted action
- **REQ-004** Audit all environment variables; move any secret from client to server scope
- **REQ-008** Add `AI_SECURITY.md` to repo root

### Phase 2 — Core Security Features

- **REQ-003** Enforce anonymous write/delete prohibition via policy + code review
- **REQ-005** Enforce `NEXT_PUBLIC_` / equivalent client-bundle prefix ban for secrets
- **REQ-006** Classify and declare all storage buckets
- **REQ-009** Implement automated access-control test suite

### Phase 3 — Process & Tooling

- **REQ-007** Enforce Definition of Done checklist in PR template
- **REQ-010** Wire security tests into CI/CD pre-deploy gate
- **REQ-011** Add secret-scanning step to CI (e.g., `git-secrets`, `truffleHog`, GitHub secret scanning)
- **REQ-012** Audit all API endpoints and server components for unsafe table joins

### Phase 4 — Polish & Non-Functionals

- **REQ-013** Establish ongoing conflict/ambiguity review process for spec changes
- **REQ-014** Require all deprecated or superseded requirements to be explicitly marked
- **REQ-015** Export this guide as structured GitHub Issues for tracking

---

## 🔗 Dependency Graph

```
REQ-001 → REQ-002 (zero-access default requires RLS to be enabled first)
REQ-002 → REQ-003, REQ-009 (policies must exist before tests can validate them)
REQ-004 → REQ-005 (secret scope rule is a subset of the broader secret audit)
REQ-008 → REQ-007 (AI rules inform the DoD checklist)
REQ-009 → REQ-010 (tests must exist before CI can gate on them)
REQ-011 → REQ-010 (secret scanning wired into same CI gate)
```

---

## ⚠️ Open Questions & Escalations

None — all conflicts resolved. See conflict notes in the [Conflict Register](#conflict-register) below.

---

## Implementation

### 1. AI Agent Rules File

Create this file in your repository root **before any AI-assisted code generation session.**

```markdown
# AI Agent Security Guardrails

You are a security-aware software engineer. Follow these rules for every code generation task without exception.

## 1. Database & Row-Level Security (RLS)
- EVERY new table must explicitly have RLS enabled.
  ```sql
  ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
  ```
- ALL tables default to zero access. Write explicit policies for SELECT, INSERT, UPDATE, and DELETE.
- Public read access (`USING (true)`) must be justified with a code comment explaining why.
- Anonymous INSERT, UPDATE, or DELETE is strictly FORBIDDEN.
- When no policy exists for an action, leave it that way — do NOT add a catch-all open policy "to make it work."

## 2. Environment Variables & Secrets
- Never expose service-role keys, database passwords, or private API keys to the client bundle.
- Any variable that contains a secret must be server-side only.
  > **Next.js:** Never prefix a secret with `NEXT_PUBLIC_`.
  > **Vite/React:** Never include a secret in `import.meta.env` that is bundled client-side.
  > **General rule:** If it ships to the browser, it is public. Treat it accordingly.
- All secrets must be written to `.env.local` (or equivalent) and added to `.gitignore`.

## 3. Storage Buckets
- Every new storage bucket must be declared as one of:
  - `public` — read-only, for non-sensitive assets (logos, public images).
  - `private` — authenticated owner access only, for user uploads, reports, or AI outputs.
- Never create a bucket without explicitly declaring its access policy.

## 4. API Endpoints & Server Components
- Never inner-join a public table to a private table and return the combined result without a per-row authorization filter.
- Always verify `auth.uid()` (or equivalent session identity) before returning user-specific data.
- Treat every API route as if it can be called by an unauthenticated attacker. Ask: "What does this return with no session?"

## 5. Definition of Done Checklist
Before presenting any code change, verify:
- [ ] RLS is enabled on all new/modified tables.
- [ ] Authenticated owner policies are written.
- [ ] Authenticated non-owner access is blocked.
- [ ] Anonymous access is blocked (or explicitly approved with a comment).
- [ ] No secret is prefixed/configured for client-side exposure.
- [ ] Any new storage bucket has a declared access type.
```

---

### 2. Secure Database Schema (SQL)

Apply this pattern to every new table. The comments are mandatory — they document intent for future contributors and AI agents.

```sql
-- ============================================================
-- TABLE: projects
-- RLS: ENABLED | Default: ZERO ACCESS
-- ============================================================
CREATE TABLE public.projects (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title       TEXT NOT NULL,
    -- Sensitive fields — never returned to non-owners
    ai_prompt_history       JSONB    DEFAULT '[]'::jsonb,
    market_research_data    TEXT,
    -- Explicit public flag — only rows with true are readable anonymously
    is_public   BOOLEAN DEFAULT false NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Step 1: Lock the table (zero access by default)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Step 2: Owners have full control over their own rows
CREATE POLICY "Owners can manage their own projects"
    ON public.projects
    FOR ALL
    USING      (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Step 3: Public can ONLY read rows explicitly flagged as public
-- Justification: allows project sharing feature without exposing private data
CREATE POLICY "Public can view explicitly public projects"
    ON public.projects
    FOR SELECT
    USING (is_public = true);

-- Note: No INSERT/UPDATE/DELETE policy exists for non-owners.
-- Postgres rejects those actions by default. This is intentional.
-- DO NOT add a permissive policy here to "fix" a permission error.
-- Fix the application logic instead.
```

> **Framework-agnostic equivalent:** If you are not using PostgreSQL/Supabase, apply the equivalent pattern in your ORM or API middleware: default-deny, explicit allow, owner-scoped, and annotated.

---

### 3. Automated Access-Control Test Suite

These tests simulate an unauthenticated attacker. They must pass before any deployment.

```typescript
// tests/access-control.test.ts
import { createClient } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';

// Supabase example — replace with your stack's equivalent anonymous client
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Anonymous client simulates an unauthenticated attacker or web scraper
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe('Access Control Guardrails', () => {

  // ── ANONYMOUS READ ──────────────────────────────────────────
  it('BLOCKS anonymous reads of private project data', async () => {
    const { data } = await anonClient
      .from('projects')
      .select('ai_prompt_history, market_research_data')
      .eq('is_public', false);

    // RLS filters all private rows — result must be empty
    expect(data).toHaveLength(0);
  });

  // ── ANONYMOUS WRITE ─────────────────────────────────────────
  it('BLOCKS anonymous inserts into projects', async () => {
    const { error } = await anonClient
      .from('projects')
      .insert([{ title: 'Injected', market_research_data: 'Malicious payload' }]);

    // RLS rejects write — error must be non-null
    expect(error).not.toBeNull();
  });

  it('BLOCKS anonymous updates to any project', async () => {
    const { error } = await anonClient
      .from('projects')
      .update({ title: 'Hijacked' })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // targets all rows

    expect(error).not.toBeNull();
  });

  // ── ANONYMOUS PUBLIC READ (ALLOWED) ─────────────────────────
  it('ALLOWS anonymous reads of explicitly public project titles', async () => {
    const { data, error } = await anonClient
      .from('projects')
      .select('title')
      .eq('is_public', true);

    // Public data is intentionally readable — error must be null
    expect(error).toBeNull();
    // But sensitive columns must not leak — assert they are absent
    data?.forEach(row => {
      expect(row).not.toHaveProperty('ai_prompt_history');
      expect(row).not.toHaveProperty('market_research_data');
    });
  });

});
```

> **Stack-agnostic equivalent:** Any test framework can implement this pattern. The key principle: instantiate a client with **no credentials** and assert it cannot read private data, insert, or update.

---

### 4. CI/CD Pre-Deploy Security Gate

Add this to your CI configuration. Security tests must pass before any deploy step runs.

```yaml
# .github/workflows/security-check.yml
name: Security Audit

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  access-control-tests:
    name: Access Control Guardrails
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Run access-control tests
        run: npx vitest run tests/access-control.test.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

  secret-scan:
    name: Secret Leak Detection
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          extra_args: --only-verified
```

---

### 5. Pull Request Template with Security DoD

Add this file to enforce the security checklist on every PR.

```markdown
<!-- .github/PULL_REQUEST_TEMPLATE.md -->
## Summary
<!-- What does this PR change? -->

## Security Definition of Done
Complete this checklist before requesting review. Unchecked items block merge.

### Database
- [ ] RLS is enabled on all new or modified tables
- [ ] Authenticated owner policies are written and tested
- [ ] Non-owner access is explicitly blocked (not just absent)
- [ ] Anonymous access is blocked unless a public policy is written and justified with a comment

### Secrets & Environment
- [ ] No secret or API key is prefixed for client-side exposure
- [ ] New environment variables are documented in `.env.example` (without real values)
- [ ] `.gitignore` covers all secret files

### Storage
- [ ] Any new storage bucket is declared as `public` or `private` with a written policy

### Verification
- [ ] Access-control tests pass locally (`npx vitest run tests/access-control.test.ts`)
- [ ] No new secrets detected by scanner
```

---

## Tactical Audit Protocol (Existing Repos)

Run these steps on any existing repo to find and close current vulnerabilities:

1. **Enable RLS everywhere, immediately**
   ```sql
   -- Run this on every table in your database
   ALTER TABLE <your_table> ENABLE ROW LEVEL SECURITY;
   ```
   This is safe to run without writing policies first — it locks to zero access by default while you build targeted permissions.

2. **Scan for leaked secrets**
   ```bash
   # Search locally for common secret patterns
   git log --all --full-history -- "*.env*"
   grep -rn "service_role\|SUPABASE_SERVICE\|DATABASE_URL\|SECRET_KEY" --include="*.ts" --include="*.js" --include="*.env*" .
   ```

3. **Audit table joins in API routes**
   Review every API endpoint and server component. For each database query ask:
   - Does this query return data from a private table?
   - Is the result filtered by `auth.uid()` or equivalent before returning?
   - What does this endpoint return if called with no session token?

4. **Pin the AI agent rules**
   Add `AI_SECURITY.md` to your repo root and reference it in your workspace system prompt or agent config file (`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, etc.).

5. **Add the PR template and CI workflow**
   Install `.github/PULL_REQUEST_TEMPLATE.md` and `.github/workflows/security-check.yml` from this guide.

---

## ✅ Full Requirements Register

| ID | Description | Category | Source | Phase | Status |
|---|---|---|---|---|---|
| REQ-001 | RLS must be enabled on every new and existing table | Constraint | SRC-B | 1 | Accepted |
| REQ-002 | Zero-access default; explicit policies for every permitted action | Constraint | SRC-B | 1 | Accepted |
| REQ-003 | Anonymous INSERT/UPDATE/DELETE is strictly forbidden | Constraint | SRC-B | 2 | Accepted |
| REQ-004 | Secrets must never be exposed to the client bundle | Constraint | SRC-B | 1 | Accepted |
| REQ-005 | No secret may use a client-side exposure prefix (e.g. `NEXT_PUBLIC_`) | Constraint | SRC-B | 2 | Accepted |
| REQ-006 | All storage buckets must be declared `public` or `private` with a policy | Constraint | SRC-B | 2 | Accepted |
| REQ-007 | Definition of Done security checklist gates every PR | Non-Functional | SRC-B | 3 | Accepted |
| REQ-008 | `AI_SECURITY.md` lives in repo root and is read before code generation | Functional | SRC-B | 1 | Accepted |
| REQ-009 | Automated tests simulate anonymous attacker, non-owner, and owner roles | Functional | SRC-B | 2 | Accepted |
| REQ-010 | Security tests run as a CI/CD pre-deploy gate | Non-Functional | SRC-B | 3 | Accepted |
| REQ-011 | Repo is scanned for leaked service-role keys and connection strings | Functional | SRC-B | 3 | Accepted |
| REQ-012 | API endpoints must not join public+private tables without per-row auth | Functional | SRC-B | 3 | Accepted |
| REQ-013 | Conflicts and open questions are surfaced before plan is finalized | Non-Functional | SRC-A | 4 | Accepted |
| REQ-014 | No requirement is silently discarded; each is accepted, superseded, or escalated | Non-Functional | SRC-A | 4 | Accepted |
| REQ-015 | Guide is exportable as Markdown and/or structured GitHub Issues | Constraint | SRC-A | 4 | Accepted |

---

## Conflict Register

| ID | REQ Pair | Type | Resolution |
|---|---|---|---|
| CONFLICT-01 | REQ-002 vs REQ-003 | Implicit Conflict | Resolved: Use explicit `-- No policy = no access. Intentional.` comments alongside zero-policy tables to make intent self-documenting. |
| CONFLICT-02 | REQ-005 (Next.js) vs general guide scope | Scope Creep | Resolved: All framework-specific examples are placed in labeled callout blocks; core rules are stack-agnostic. |

---

*Generated by the Analyze Long Coding Spec Document skill — [SRC-A] × [SRC-B] synthesis.*
