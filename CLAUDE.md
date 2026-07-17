<!-- agent-defaults:canonical start — managed by sync, do not edit below -->
# Yerba Buena — Agent Operating Manual (canonical defaults)

> The default rules for any AI agent (Claude Code, Codex, Replit, Gemini) working in a Yerba Buena repo. Copy this file into a new repo as `AGENTS.md` (and symlink/duplicate to `CLAUDE.md`, `CODEX.md`, `replit.md` if you use those tools — **keep all agent files in sync**). Then add a short repo-specific section at the bottom for that project's stack, URLs, and quirks.
>
> Synthesized from the strongest examples in the org: `access-manager/CLAUDE.md`, `metrc-ny-client/CLAUDE.md`, `incoming-deliveries/CLAUDE.md`, `cash-bank/.agents/skills/plan-review`, `sales-performance` (memory + cron), `ims/design/AGENTS.md`, `homepage` (agent-file sync). v1 — refine via PR.

## 1. Orient before you act

- **Source-of-truth order:** the running code → the repo's `README.md`/`docs/` → committed specs/plans → issues. Read these before changing anything; if reality contradicts a doc, flag it and ask — don't silently "fix" to match a stale doc.
- **Read the FULL GitHub issue body AND its comments** before working an issue. Never act from the title alone — scope, decisions, and constraints live in the body/comments. Confirm the target repo is correct (issues are sometimes filed on the wrong app).
- Prefer the most recent, most-tested repo as your pattern reference (e.g. `cash-bank`, `access-manager`, `ims`).

## 2. The working loop

**Three defaults hold for every non-trivial task — before and during the loop below:**

- **Interview for the real goal (the "why").** Before speccing, draw out the human's underlying intent — don't build to a literal ask that misses the goal.
- **Small, vertical slices of value.** Prefer small, compartmentalized specs that each deliver one full, concrete unit of value working **end-to-end** (shippable and verifiable on its own) over horizontal layers that only integrate at the end. Put the risk early, not piled up at the finish.
- **Explicit human sign-off on key decisions.** Surface the key **user** and **architecture** decisions — options plus your recommendation — and have the human verify them before building. Never proceed on unverified assumptions. (Pairs with the AskUserQuestion decision-gates and the Codex tie-break table, §10.)

Then the loop:

1. **Interview for the "why," then brainstorm → spec → plan.** For anything non-trivial, draw out the real goal first, then write a short design/spec and a task-by-task plan to `docs/superpowers/plans/` (or `docs/plans/`) **before** writing code — sliced into small, vertical units of value. Get the plan architect-reviewed (see §4).
2. **Comment the plan on the issue(s) it covers**, with links, as you go — the issue is the source of truth for collaborators.
3. **Implement task-by-task, TDD** (§3). Commit between work items with a clear message.
4. **Verify** (§5) before claiming done. Open a PR; the human merges and verifies UI on the live env.

**Bug workflow:** file a GitHub issue → architect-review the fix plan → post the plan on the issue → implement → close with the resolving PR/commit linked.

## 3. Tests are non-hollow or they don't count

- **TDD, red→green→refactor.** Write the failing test first; **run it and confirm it fails for the right reason** (feature missing — not a typo/import error).
- A test must **fail under a realistic wrong implementation** — a missing param, swapped fields, an off-by-one. If it can't, it's hollow. Delete it and write a real one.
- **Named hollow-test anti-patterns to reject** (from `cash-bank`'s test-quality review):
  - `array.every(predicate)` / `array.some(...)` on a possibly-empty array (empty ⇒ vacuously true).
  - `if (data.length > 0) { expect(...) }` — silently skips when empty.
  - Asserting two reads of the same endpoint equal each other (trivially true).
  - Count-math like `open + resolved === total` when every count can be 0.
- Pin real values: URLs, params, response shapes — not just "truthy".
- Aim for **high coverage with meaningful assertions**. The **non-hollow review is the real gate**, not a number — but **enforce ~90% thresholds in `vitest.config.ts` where you can** (`metrc-ny-client` is the model; most repos don't yet — add them). Add **source-level guards** for invariants that live in unchanged code (read the source as text and assert).
- Use **dependency injection / seams** so logic is testable without live services; gate DB tests with `describe.skipIf(!dbAvailable())`.

## 4. Plans and tests get an architect review

Before proposing/executing a plan, and after writing a test suite, run a critical self-review (or an architect subagent — see `cash-bank/.agents/skills/plan-review`): completeness, sequencing, risk, scope creep, and the hollow-test checklist above. The review also confirms the key **user** and **architecture** decisions were **explicitly human-verified** (§2), not assumed. Verdict must be APPROVE (or APPROVE-WITH-NOTES) before proceeding; otherwise revise and re-review.

## 5. Verify before you claim done

- `npm run check` (tsc) **and** the test suite green; production `build` clean.
- Never assert "fixed/working/passing" without showing the command output. If something is skipped or failing, say so.
- Operator handoff: one-line summary of what changed, the gates you ran (with results), and a clean tree.

## 6. Hard rules

- **No fallback secrets.** Never `process.env.SECRET || 'fallback'`. Validate presence at boot and **fail loudly**; surface required-secret presence in a `/api/health` or startup secret-check (presence only, never values).
- **No mock/placeholder/fallback synthetic data** in app code paths. Real data or an explicit empty/error state.
- **Migrations: `db:push` in dev, generated migrations in prod.** Use the Drizzle workflow only — never hand-write SQL. **Dev/prototyping:** `drizzle-kit push` is fine. **Prod (and any shared DB with real data):** commit generated migrations (`drizzle-kit generate` → `migrations/` + `meta/_journal.json`) applied by an **explicit deploy-time migrator** — never `push` against prod (its diff-and-apply can silently drop data). Keep a read-only **constraint-drift verifier** (`db:verify`, per `incoming-deliveries`) so `schema.ts` and the live DB can't diverge unnoticed.
- **Vendored YB libraries** (e.g. `@yerba-buena/flowhub-client`, `metrc-ny-client` under `vendor/`) are committed copies, **not** submodules. Any change must also be pushed upstream to the source repo, and re-vendored deliberately (pin the upstream commit; see the vendor `README`). In worktrees with symlinked `node_modules`/`.env`, never `git add -A` — stage explicit paths so secrets don't leak.
- **`push to main` ≠ production.** Replit Publish/Deploy is a separate step, and **Replit Publish copies schema, not data** — prod data changes must hit prod directly. Dev and prod are separate databases.
- **YBAM integrations ship a secure dev bypass.** Any YBAM OIDC integration MUST also ship the fail-closed, dev-only auth bypass (activates only in a Replit dev workspace; **crashes the boot** if the flag is set in prod; injects a configurable `ybam_access` identity; no silent admin default) with adversarial tests. Copy the canonical `reference/ybam-dev-bypass/`; **never delete it when real YBAM lands** — it stays alongside real auth. Env: `YBAM_DEV_AUTH_BYPASS` / `YBAM_DEV_USER` / `YBAM_DEV_GRANTS`.

## 7. Commits, branches, memory

- One branch (often a git worktree) per task/PR; branch each slice off fresh `origin/main` — never stack PRs on an unmerged branch.
- Commit messages: conventional prefix (`feat:`/`fix:`/`chore:`…) + a `Co-Authored-By:` trailer for the agent. Commit between work items, not one giant commit.
- Keep an **`.agents/memory/MEMORY.md`** index pointing to topic files — one durable lesson per file, written the moment a real operational footgun bites (the `sales-performance` repo is the model: every entry is a specific production gotcha, not a hypothetical).

## 8. UI work uses the design system

- **Vendor** the design system (repo: `tool-design-system`) into `design/` pinned to an upstream commit — track it in `design/VENDORED.md` (per `ims`/`sales-performance`). It's a vendored snapshot, **not** an installed npm package. Consume its semantic tokens (`--bg-surface`, `--text-strong`, `--row-h`, `--chart-1..8`); **never** hard-code hex or consume raw ramp values (`--n-700`); a `grep -rInE '#[0-9a-fA-F]{3,6}|rgb\(' --include=*.css` of your component CSS should be empty.
- `Geist Mono` + tabular numerals for data the eye compares/copies (SKUs, IDs, prices, %, counts, timestamps); `Geist` sans for prose. Never mix faces in one phrase. Sentence case; Lucide icons only (`currentColor`, no emoji). Touch targets ≥ `--touch-min` (44px).
- Run the design system's **pre-PR self-check** (both themes × all densities × 480/768px, keyboard focus, CHANGELOG). See `tool-design-system/AGENTS.md`.
- The test env is node-only and can't render — **UI changes are eyeballed on the live env (Replit) before merge.**

## 9. Stack & deploy

See `STACK.md` for the default app stack and `DEPLOY.md` for Cloudflare-vs-Replit deploy guidance. The short version: the org's default full app is the **"rest-express"** pattern (Express + Vite/React + Drizzle/Neon, deploys to Replit autoscale); static sites use **Astro → Cloudflare Pages**; heavier Node apps use **Next.js + Docker → Render**.

When deploying to **Replit / Cloudflare / Vercel**, **connect that platform's MCP/connector** so you can verify prod and handle setup/config — see DEPLOY.md **"Platform integrations."** Required whenever the platform is the deploy target. Read/verify freely; mutating infra needs human approval.

## 10. Agent toolchain — superpowers (plan/execute) + Codex (cross-model review)

> Every agent installs **both**: the **superpowers** framework (obra/superpowers) to
> *enforce* the §2 loop (brainstorm → plan → execute), and the **Codex plugin for Claude
> Code** so an independent second model reviews the work at two gates. Don't hand-roll either.

### Superpowers — planning & execution

- **Claude Code** (per machine, once):
  - `/plugin install superpowers@claude-plugins-official`  *(official marketplace)*
  - or from upstream: `/plugin marketplace add obra/superpowers-marketplace` → `/plugin install superpowers`
  - Brings `/brainstorm`, `/write-plan`, `/execute-plan`, skills-search, and SessionStart context injection.
- **Loop → skill mapping:**
  - Brainstorm/spec (§2.1) → `/brainstorm` — refine the idea, explore alternatives, save the design doc.
  - Plan → `/write-plan` — bite-size tasks w/ exact paths, code, and verification, written to `docs/superpowers/plans/<slug>.md`.
  - Architect review (§4) → review plan + test suite; APPROVE / APPROVE-WITH-NOTES gate before executing (pairs with `cash-bank/.agents/skills/plan-review`).
  - Execute → `/execute-plan` — subagent-driven, task-by-task, commit between items (§7), TDD (§3).
- **Plans live in the repo** and are linked on the issue (§2.2) so non-Claude tools (Codex/Gemini/Replit) and humans follow the same plan — the *skills* are Claude-Code-specific, the *plan docs* are universal.

### Codex cross-model review (required for non-trivial work)

The goal: get Claude and Codex to **converge** on the architecture and the final output — and
where they don't, **surface the disagreement with a recommendation for the human to tie-break.**
Never silently pick a side.

- **Install** (once per machine — official plugin `openai/codex-plugin-cc`):
  ```
  /plugin marketplace add openai/codex-plugin-cc
  /plugin install codex@openai-codex
  /reload-plugins
  /codex:setup
  ```
  Prereqs: **Node ≥ 18.18**, the Codex CLI (`npm install -g @openai/codex`), and `codex login`
  (ChatGPT subscription or OpenAI API key). `/codex:setup` verifies install + auth.
- **Two required gates** — run for any non-trivial change; skip only trivial mechanical edits:
  1. **Architecture gate** — after the spec + plan are written and self-reviewed (§2/§4),
     **before** implementation. Adversarial pass on the design:
     `/codex:adversarial-review --base origin/main` — focus it on the architecture decisions and
     assumptions in the committed spec/plan (Codex is prompted to challenge, not rubber-stamp).
  2. **Final-output gate** — after implementation is green (§5), **before** opening the PR:
     `/codex:review --base origin/main` on the diff.
- **Reconcile, then surface.** Fold in points Claude accepts (note them). For each **open
  disagreement**, do **not** resolve it silently — record it and put it in front of the human:

  | # | Point | Claude's position | Codex's position | Recommendation | Your call |
  |---|-------|-------------------|------------------|----------------|-----------|
  | 1 | …     | …                 | …                | Claude leans X because… | ☐ |

  Give a clear recommendation + reasoning per row; the **human tie-breaks**. Architecture-gate
  disagreements **block merge** until resolved; final-output disagreements are surfaced in the PR
  body. Every PR includes the Codex summary + this table (or "Codex concurred — no open
  disagreements"). Optional auto-gate: `/codex:setup --enable-review-gate`.

- Keep this (superpowers + Codex) synced across `AGENTS.md`/`CLAUDE.md`/`CODEX.md`/`replit.md` — use `tools/sync-agent-files` (see §7 / that tool's README).
<!-- agent-defaults:canonical end (source: agent-defaults@ae11f05) -->

## Repo-specific — flowhub-client-ts (Archetype D: published library)

Unofficial **TypeScript client for the Flowhub API** — `@yerba-buena/flowhub-client`, **published to npm** (public). This is the **Archetype D "published npm" tier** (agent-defaults `STACK.md`) and the org's CI/release template. Apps consume it as a normal npm dependency (e.g. `business-intelligence`, `sales-performance`).

- **Build / publish:** `tsup` → dual **ESM + CJS** with `dts`; rich `exports` map (public surface + a separate internal entrypoint); `sideEffects: false`; `publishConfig.access: public`. **publint + attw** (attw as its own CI job). **Changesets** releases (`changeset` / `version-packages` / `release`); release workflow gated on repo name + `NPM_TOKEN`.
- **Toolchain:** **biome** (lint/format) + **vitest**; test layering `unit` / `contract` (msw) / `integration` (live, opt-in). CI = Node **18/20/22** matrix → typecheck → lint → test → build → publint. Strict tsconfig (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: Bundler`).
- **Gap to close (per Archetype D):** `vitest.config.ts` has **no coverage thresholds** — add ~90% (`metrc-ny-client` is the model). This repo is the CI/release template but not yet the coverage exemplar.
- **Client conventions:** injectable **`fetchFn`** seam (SSRF/proxy/test-stub); **never log or persist credentials** (see `src/internal/README.md` — dedicated service account, secrets-manager, rotation); public vs reverse-engineered surfaces split into separate entrypoints; `DISCLAIMER.md` unofficial-client boilerplate.
- Public repo (MIT). No Replit/YBAM/deploy sections apply.
