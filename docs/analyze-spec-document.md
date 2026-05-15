# Skill: Analyze Long Coding Spec Documents

## Purpose
Parse, reconcile, and synthesize large or multi-source technical specification documents into a single, coherent, prioritized development plan — even when sources conflict, overlap, or are incomplete.

---

## When to Use This Skill
- User provides one or more specification documents (pasted text, file links, or uploaded files).
- User asks to "build a plan from this spec", "resolve conflicts between these docs", "turn this into a roadmap", or similar.
- The spec is long (>1,000 lines), multi-author, or clearly assembled from multiple sources.
- Requirements appear contradictory, ambiguous, or versioned inconsistently.

---

## Workflow

### Step 1 — Ingest & Segment
1. Read the entire document before drawing any conclusions.
2. Identify and label distinct **source sections** (e.g., different authors, dates, document titles, or formatting styles).
3. Tag each section with a provisional source identifier: `[SRC-A]`, `[SRC-B]`, etc.
4. Note any explicit version numbers, dates, or author attributions.

### Step 2 — Extract Requirements
For each source section, extract every requirement and categorize it:

| Category | Description |
|---|---|
| **Functional** | What the system must *do* |
| **Non-Functional** | Performance, security, scalability, accessibility |
| **Constraint** | Technology choices, deadlines, compliance mandates |
| **Assumption** | Unstated expectations that drive a requirement |
| **Out of Scope** | Explicitly excluded features |

Assign each requirement a unique ID: `REQ-001`, `REQ-002`, etc.

### Step 3 — Detect Conflicts & Ambiguities
Scan for the following conflict types and flag them explicitly:

- **Direct Contradiction**: Two requirements state opposing behaviors for the same scenario.
- **Scope Creep / Overlap**: The same feature is described differently across sources with incompatible scope.
- **Implicit Conflict**: Requirements that don't directly contradict but cannot both be satisfied (e.g., "real-time sync" vs. "offline-first").
- **Version Drift**: An older source specifies behavior that a newer source supersedes without explicit callout.
- **Ambiguity**: A requirement is underspecified and could be interpreted multiple ways.

For each detected issue, output:
```
⚠️ CONFLICT [ID]: REQ-xxx vs REQ-yyy
Type: <conflict type>
Sources: [SRC-A] vs [SRC-B]
Summary: <one-sentence description>
Resolution Options:
  A) <option>
  B) <option>
Recommended: <A or B, with rationale>
```

### Step 4 — Apply Resolution Heuristics
When the user has not specified a resolution strategy, apply these heuristics in order:

1. **Recency wins** — Prefer the requirement from the most recently dated source.
2. **Specificity wins** — Prefer the more detailed/precise requirement over a vague one.
3. **Constraint trumps feature** — Hard constraints (compliance, security, platform limits) override feature requests.
4. **User-facing over internal** — When scope must be cut, prefer requirements visible to end users.
5. **Escalate if unresolvable** — If none of the above apply, flag for human decision and provide a clear trade-off summary.

### Step 5 — Build the Development Plan

Output the plan in the following structure:

---

#### 📋 Executive Summary
- Project goal (1–2 sentences synthesized from spec)
- Key constraints and non-negotiables
- Total number of requirements ingested, conflicts found, and conflicts resolved

---

#### 🗺️ Phased Roadmap

Organize requirements into phases based on dependency order and business value:

**Phase 1 — Foundation** *(prerequisites for everything else)*
- Core data models
- Authentication / authorization
- Infrastructure setup

**Phase 2 — Core Features** *(primary user-facing functionality)*
- List each REQ-xxx with a one-line description

**Phase 3 — Extended Features** *(secondary functionality, nice-to-haves)*

**Phase 4 — Polish & Non-Functionals** *(performance, accessibility, observability)*

---

#### 🔗 Dependency Graph (textual)
List blocking relationships:
```
REQ-005 → REQ-012 (REQ-012 requires REQ-005 to be complete first)
REQ-003 → REQ-007, REQ-009
```

---

#### ⚠️ Open Questions & Escalations
List every unresolved conflict or ambiguity that requires a human decision, with the trade-off clearly stated.

---

#### ✅ Full Requirements Register
A complete table:

| ID | Description | Category | Source | Phase | Status |
|---|---|---|---|---|---|
| REQ-001 | ... | Functional | SRC-A | 1 | Accepted |
| REQ-002 | ... | Constraint | SRC-B | 1 | Accepted |
| REQ-003 | ... | Functional | SRC-A, SRC-B | 2 | Conflict Resolved |
| REQ-004 | ... | Functional | SRC-C | — | Escalated |

---

### Step 6 — Confirm & Iterate
After presenting the plan:
1. Ask the user to review the **Open Questions** section and provide decisions.
2. Offer to regenerate the roadmap with updated resolutions applied.
3. Offer to export the plan as a structured format (Markdown, GitHub Issues, CSV).

---

## Output Rules
- **Never silently discard** a requirement — either include it, mark it as superseded, or escalate it.
- **Always cite the source** for every requirement using the `[SRC-X]` tag.
- **Do not hallucinate requirements** — only extract what is present in the provided documents.
- If the document is extremely long, process it in clearly labeled chunks and merge at the end rather than truncating.
- Present conflicts **before** the final plan so the user can course-correct early.

---

## Example Invocation
> "Here are three spec documents from different stakeholders. They were written at different times and I know some parts conflict. Please analyze them and give me a development plan I can take to engineering."

1. Ingest all three documents, label them `[SRC-A]`, `[SRC-B]`, `[SRC-C]`.
2. Run Steps 1–4.
3. Output the development plan per Step 5.
4. Prompt the user to resolve any escalated conflicts before finalizing.
