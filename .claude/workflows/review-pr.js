export const meta = {
  name: 'review-pr',
  description:
    'Multi-lens adversarial review of a migration PR diff. N lenses find issues in parallel, each finding is adversarially verified (default = refute), then confirmed findings are deduped and synthesized into a report. Args: { diffRef, mono, domain, context }.',
  phases: [{ title: 'Review' }, { title: 'Verify' }, { title: 'Synthesize' }],
};

// ── Parameters (override via Workflow args) ──────────────────────────────────
const diffRef = args?.diffRef ?? 'develop'; // base to diff the PR against
const mono = args?.mono ?? 'pg-e2e-harness'; // validated source-of-truth branch
const domain = args?.domain ?? 'the changed domain';
const extra = args?.context ?? '';

// ── Review lenses (migration-specific; add/remove to scale cost) ─────────────
const LENSES = [
  {
    key: 'schema-sql-parity',
    focus: `schema/index.ts vs the raw migration .sql — every column, enum, index, constraint, default, GENERATED expression, and trigger must agree between the two, AND generated/CASE expressions + triggers must match their app-side source of truth (e.g. stepToStatus()). Flag schema-ahead-of-SQL and SQL-ahead-of-schema drift.`,
  },
  {
    key: 'fk-index-coverage',
    focus: `every FK column must have a FULL b-tree index. A partial-unique index leading with the FK column does NOT count (it excludes soft-deleted rows, so it can't back ON DELETE CASCADE). Scrutinize junction + soft-delete tables. Check naming (<table>_<col>_idx) and schema↔SQL index parity.`,
  },
  {
    key: 'auth-correctness',
    focus: `asDrizzleCondition ports (member/sensitivity/aggregate) — generated SQL must match Neo4j/Gel semantics. Check ref-map arms, enum casts (::role[]), EXISTS subqueries, and that unmigrated domains fail loud (default: throw) instead of emitting SQL against non-existent tables.`,
  },
  {
    key: 'mono-drift-logic',
    focus: `compare the recut against ${mono} (validated source of truth) via 'git diff ${mono} -- <files>' and 'git show ${mono}:<path>'. Flag behavioral divergence that ISN'T an intended strip (pin/audit) or renumber, plus correctness bugs, missing NotImplementedException guards, untagged engine conditionals, and silent sort-key fallbacks.`,
  },
];

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'file', 'severity', 'description'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          severity: { type: 'string', enum: ['P1', 'P2', 'P3', 'P4'] },
          description: { type: 'string' },
          suggestedFix: { type: 'string' },
        },
      },
    },
  },
};

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'reasoning'],
  properties: {
    isReal: { type: 'boolean' },
    reasoning: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

const reviewPrompt = (lens) =>
  `You are reviewing a Postgres/Drizzle migration PR for the cord-api-v3 Neo4j→PG migration.
Get the PR diff with: git diff ${diffRef}
Domain: ${domain}. ${extra}

Review ONLY through this lens:
${lens.focus}

Read whatever you need (changed files, their ${mono} equivalents via 'git show ${mono}:<path>', the app-side sources referenced). Report concrete findings with file + line. No style nits, nothing outside your lens. If clean, return an empty findings array.`;

const verifyPrompt = (f) =>
  `Adversarially verify this claimed finding from a migration PR review. Default to REFUTE unless evidence is clear.
Finding: ${f.severity} — ${f.title}
File: ${f.file}${f.line ? ':' + f.line : ''}
Claim: ${f.description}

Read the actual code (git diff ${diffRef}, the file, its ${mono} equivalent). Is this a REAL issue to fix/block, or a false positive / already-handled / intended-strip? Set isReal with reasoning.`;

// ── Review → per-finding adversarial verify (pipelined, no barrier) ──────────
phase('Review');
const results = await pipeline(
  LENSES,
  (lens) =>
    agent(reviewPrompt(lens), {
      label: `review:${lens.key}`,
      phase: 'Review',
      schema: FINDINGS_SCHEMA,
    }),
  (review, lens) =>
    parallel(
      (review?.findings ?? []).map((f) => () =>
        agent(verifyPrompt(f), {
          label: `verify:${lens.key}`,
          phase: 'Verify',
          schema: VERDICT_SCHEMA,
        }).then((v) => ({ ...f, lens: lens.key, verdict: v })),
      ),
    ),
);

const all = results.flat().filter(Boolean);
const confirmed = all.filter((f) => f.verdict?.isReal);

// ── Synthesize ───────────────────────────────────────────────────────────────
phase('Synthesize');
const report = await agent(
  `Synthesize a migration-PR review report from these VERIFIED findings (false positives already removed). Dedupe overlaps across lenses. Group by severity (P1→P4); for each give title, file:line, why it matters, suggested fix. End with a one-line verdict (block / fix-then-merge / clean). H3 + bullets, no tables.

Verified findings (JSON):
${JSON.stringify(confirmed, null, 2)}

Raw findings before verification: ${all.length}; confirmed: ${confirmed.length}.`,
  { label: 'synthesize', phase: 'Synthesize' },
);

return report;
