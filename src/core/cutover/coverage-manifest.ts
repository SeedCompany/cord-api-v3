/**
 * Cutover coverage manifest — every name the SOURCE graph can enumerate about
 * itself, and what the ETL does with it.
 *
 * WHY THIS EXISTS. Every other cutover check enumerates from OUR list: the
 * reconciliation counts the rows the extractors read, the verifier walks the
 * Postgres schema, the shadow-diff replays operations someone wrote down. All of
 * them can only confirm what someone already thought of. This file flips the
 * direction: Neo4j enumerates itself — `db.labels()`, `db.relationshipTypes()`,
 * `db.propertyKeys()` — and every name it returns must be claimed here with a
 * disposition. The coverage run FAILS on anything the source names that this
 * file does not, so a domain, field, or edge nobody thought about cannot slip
 * through silently. Same shape as the scrub's `assertFullyClassified` and the
 * verifier's `assertEveryUnenforcedColumnIsClassified`, built for the same
 * reason: an allowlist tells you what you forgot; a blocklist never does.
 *
 * THE FIVE DISPOSITIONS:
 *  - `migrated`         — carried. For labels: names the extractor and target
 *                         table, and the run compares the SOURCE node count
 *                         against the Postgres row count, requiring any gap to
 *                         match the entry's written-down `shortfall`.
 *  - `structural`       — an interface/marker label or a duplicate edge whose
 *                         information is carried implicitly by the target
 *                         schema's shape.
 *  - `property-storage` — Neo4j's field storage, not an entity: the `*Name`/
 *                         `*Status`-style labels on `Property` records. The
 *                         VALUE such a record holds is claimed by the
 *                         relationship type pointing at it.
 *  - `excluded`         — deliberately not carried, with the reason written
 *                         down. An exclusion without a reason is not a decision.
 *  - `review`           — BLOCKS the run. An unanswered question is not a
 *                         default to excluded. (The scrub's rule, kept.)
 *
 * PROPERTY KEYS ARE THE HIGHEST-VALUE AXIS. A property no extractor reads means
 * every row still arrives, every table still reconciles, and a column is
 * silently empty — nothing else in the pipeline can see that class.
 *
 * SOFT-DELETED LABELS. Neo4j soft-delete PREFIXES labels (`Deleted_Project`,
 * and a twice-deleted record is `Deleted_Deleted_Property`). One rule, applied
 * by the checker, covers them: a `Deleted_`-prefixed label with no entry of its
 * own is claimed as "the soft-deleted counterpart of <base>, not carried — the
 * ETL is live-only", PROVIDED the fully-stripped base label has an entry here.
 * An explicit entry always wins over the rule — `Deleted_VariantResponse` below
 * is carried on purpose, and says so.
 *
 * COUNTS ARE SNAPSHOT-PINNED, DELIBERATELY. Every `shortfall` count below was
 * measured and root-caused against the 2026-08-24 production copy, loaded from
 * current HEAD into `cord_cutover_r2` (2026-08-24; supersedes the 2026-08-20
 * `cord_cutover_verify` load, which predates the creator-fallback fix and
 * migration 0039). That load also built a `pnp_data` table, from a migration
 * since withdrawn — see the PnpData entry. It is harmless: nothing counts a
 * table the schema no longer declares, so no reload is owed on its account.
 * On a newer snapshot the numbers WILL drift and the run
 * WILL go red — that is the designed behavior: an unexplained delta blocks
 * until someone re-verifies the reason still holds and updates the number.
 * Never update a count without re-verifying its reason.
 *
 * WHEN THE RUN FAILS ON AN UNCLAIMED NAME: do not guess from the name. Probe
 * what carries it (`MATCH (n) WHERE n.<key> IS NOT NULL RETURN labels(n),
 * count(*)` — or the targeted equivalents in this file's history), find the
 * reader in `src/`, and write a disposition whose reason states what you
 * measured. Every `excluded` entry below cites its evidence.
 */

export interface ExpectedShortfall {
  /** Source rows that verifiably do NOT arrive. */
  readonly count: number;
  /** The verified cause — not a guess, and never just "dropped". */
  readonly reason: string;
}

export type Disposition =
  | {
      readonly kind: 'migrated';
      /** Where it lands: `table.column`, a table's rows, or how it is derived. */
      readonly to?: string;
      /** Labels: the extractor that carries it (its `name`). */
      readonly extractor?: string;
      /** Labels: count this Postgres table against the source node count. */
      readonly table?: string;
      /** Labels: SQL predicate narrowing `table` to this label's rows. */
      readonly where?: string;
      /** Labels: OTHER source labels whose nodes land in the same counted rows. */
      readonly plusLabels?: readonly string[];
      /** Labels: the written-down explanation for source-vs-target count gaps. */
      readonly shortfall?: readonly ExpectedShortfall[];
    }
  | { readonly kind: 'structural'; readonly why: string }
  | { readonly kind: 'property-storage'; readonly why: string }
  | { readonly kind: 'excluded'; readonly reason: string }
  | { readonly kind: 'review'; readonly question: string };

const structural = (why: string): Disposition => ({ kind: 'structural', why });
const propertyStorage = (why: string): Disposition => ({
  kind: 'property-storage',
  why,
});
const excluded = (reason: string): Disposition => ({
  kind: 'excluded',
  reason,
});
/**
 * Currently unused, and deliberately kept.
 *
 * As of 2026-08-25 every name the source enumerates has a decided disposition —
 * ExternalDepartmentId was the last one under review, and it is now ported. So
 * this helper has no call sites, which is the good state rather than dead code:
 * `review` is one of the five dispositions, the checker still refuses to pass on
 * it, and the next unclaimed name that turns up needs it to be here. Deleting it
 * would quietly make "I don't know yet" harder to express than "excluded", which
 * is exactly the pressure this file exists to resist.
 */
// eslint-disable-next-line @seedcompany/no-unused-vars
const review = (question: string): Disposition => ({
  kind: 'review',
  question,
});
/** A relationship type or property key whose value is carried — says where. */
const carried = (to: string): Disposition => ({ kind: 'migrated', to });

// ─────────────────────────────────────────────────────────────────────────────
// AXIS 1 — node labels (199 in the 2026-08-24 production copy; 127 live).
// `Deleted_*` labels are covered by the checker's live-only rule unless they
// have an explicit entry here.
// ─────────────────────────────────────────────────────────────────────────────

export const labels: Readonly<Record<string, Disposition>> = {
  // ── Interface / marker labels — carried implicitly ─────────────────────────
  BaseNode: structural('the universal interface label every entity carries'),
  Actor: structural('interface over User + SystemAgent (2,376 + 2 = 2,378)'),
  AnonUser: structural(
    'marker on the anonymous user; the node itself migrates via its User label',
  ),
  RootUser: structural(
    'marker on the root user; carried as users.is_root = true (the user extractor reads this label)',
  ),
  DefaultOrganization: structural(
    'marker on the config-referenced default organization; the node migrates via Organization',
  ),
  Commentable: structural(
    'interface — resources that can hold comment threads',
  ),
  Postable: structural('interface — resources that can hold posts'),
  Producible: structural(
    'interface — but in Neo4j PRODUCTS carry it too, so it must never be enumerated: ' +
      'MATCH (n:Producible) would insert every Product into producibles. Rows are ' +
      'counted by the concrete labels Film/Story/EthnoArt',
  ),
  BaseFile: structural(
    'marker on a subset of File/FileVersion nodes (138,838 + 64,618 measured 2026-08-24); rows migrate via FileNode',
  ),
  FileNode: {
    kind: 'migrated',
    extractor: 'file',
    table: 'file_nodes',
    to: 'the single-table Directory/File/FileVersion tree',
    shortfall: [
      {
        count: 89,
        reason:
          '88 Files + 1 FileVersion whose createdBy user is absent or soft-deleted — ' +
          'created_by_id is NOT NULL (measured 2026-08-24; zero versions are missing mime/size)',
      },
    ],
  },
  TemporalMedia: structural('interface over Video + Audio media'),
  VisualMedia: structural('interface over Image media (+ video stills)'),
  Engagement: {
    kind: 'migrated',
    extractor: 'engagement',
    table: 'engagements',
    to: 'single-table inheritance over Language/Internship engagements',
    shortfall: [
      {
        count: 11,
        reason:
          'live engagements under a soft-deleted project (9 language + 2 internship) — the ' +
          'project never lands and engagements.project_id is NOT NULL (measured against the ' +
          'graph 2026-08-24)',
      },
    ],
  },
  PeriodicReport: {
    kind: 'migrated',
    extractor: 'periodic-report',
    table: 'periodic_reports',
    to: 'one table over Financial/Narrative/Progress reports',
    shortfall: [
      {
        count: 6897,
        reason:
          'no live owner — the report hangs off a soft-deleted engagement or project ' +
          '(verified against the graph 2026-08-20)',
      },
      {
        count: 114,
        reason:
          'a LIVE engagement under a soft-deleted project — the dead ancestor is two levels up, ' +
          'so a direct-parent check misses these (verified 2026-08-20)',
      },
    ],
  },
  Project: {
    kind: 'migrated',
    extractor: 'project',
    table: 'projects',
    to: 'single-table inheritance over the project subtypes',
  },
  PromptVariantResponse: {
    kind: 'migrated',
    extractor: 'prompt-variant-response',
    table: 'prompt_variant_responses',
    to: 'interface over the three prompt-response types; rows split by resource_type',
    shortfall: [
      {
        count: 35,
        reason:
          'responses under soft-deleted or never-landing reports — 5 with a dead parent edge, ' +
          '30 under live-labeled reports that never land (measured 2026-08-24)',
      },
    ],
  },
  Notification: {
    kind: 'migrated',
    extractor: 'notification',
    table: 'notifications',
    to: 'single-table inheritance over notification subtypes',
  },

  // ── Entities with their own extractor + table ──────────────────────────────
  User: {
    kind: 'migrated',
    extractor: 'user',
    table: 'users',
    to: 'users rows (AnonUser and RootUser both carry this label too)',
  },
  SystemAgent: {
    kind: 'migrated',
    extractor: 'user',
    table: 'system_agents',
    to: 'system_agents rows (the retired duplicate Anonymous agent is Deleted_SystemAgent)',
  },
  Education: {
    kind: 'migrated',
    extractor: 'user',
    table: 'educations',
  },
  Unavailability: {
    kind: 'migrated',
    extractor: 'user',
    table: 'unavailabilities',
  },
  Tool: { kind: 'migrated', extractor: 'tool', table: 'tools' },
  ToolUsage: {
    kind: 'migrated',
    extractor: 'tool-usage',
    table: 'tool_usages',
    shortfall: [
      {
        count: 4,
        reason:
          'usages under a soft-deleted container — container_type is NOT NULL and a dead ' +
          'container never resolves (measured 2026-08-24; zero usages lack a creator)',
      },
    ],
  },
  FundingAccount: {
    kind: 'migrated',
    extractor: 'fundingAccount',
    table: 'funding_accounts',
  },
  DepartmentIdBlock: {
    kind: 'migrated',
    extractor: 'departmentIdBlock',
    table: 'department_id_blocks',
  },
  EthnologueLanguage: {
    kind: 'migrated',
    extractor: 'ethnologue',
    table: 'ethnologue_languages',
  },
  Language: { kind: 'migrated', extractor: 'language', table: 'languages' },
  FieldZone: { kind: 'migrated', extractor: 'fieldZone', table: 'field_zones' },
  FieldRegion: {
    kind: 'migrated',
    extractor: 'fieldRegion',
    table: 'field_regions',
  },
  Location: { kind: 'migrated', extractor: 'location', table: 'locations' },
  Organization: {
    kind: 'migrated',
    extractor: 'organization',
    table: 'organizations',
  },
  Partner: { kind: 'migrated', extractor: 'partner', table: 'partners' },
  ProjectMember: {
    kind: 'migrated',
    extractor: 'projectMember',
    table: 'project_members',
    shortfall: [
      {
        count: 129,
        reason:
          'members of soft-deleted projects/users — hydrate-drops, verified against the graph 2026-08-20',
      },
      {
        count: 8,
        reason:
          'duplicate (project, user) memberships collapse to one row each — merged with roles ' +
          'unioned since commit 602601755 (before it, the unique index conflict-dropped one; ' +
          'the row count is identical either way, so this holds for this database regardless of ' +
          'which load produced it)',
      },
    ],
  },
  Partnership: {
    kind: 'migrated',
    extractor: 'partnership',
    table: 'partnerships',
    shortfall: [
      {
        count: 25,
        reason:
          'live partnership with a live partner AND org, but hydrate() matches the soft-deleted ' +
          "project's props without optional:true, so readMany never returns them (verified 2026-08-20)",
      },
    ],
  },
  Budget: {
    kind: 'migrated',
    extractor: 'budget',
    table: 'budgets',
    shortfall: [
      {
        count: 46,
        reason:
          'budgets of soft-deleted projects (project_id is a NOT NULL FK) — verified 2026-08-20',
      },
    ],
  },
  BudgetRecord: {
    kind: 'migrated',
    extractor: 'budget',
    table: 'budget_records',
    shortfall: [
      {
        count: 45,
        reason:
          'records under the 46 budgets of soft-deleted projects — the budget never lands and ' +
          'budget_id is NOT NULL (measured 2026-08-24; zero records have a dangling org or ' +
          'missing fiscalYear)',
      },
    ],
  },
  Ceremony: {
    kind: 'migrated',
    extractor: 'engagement',
    table: 'ceremonies',
    shortfall: [
      {
        count: 11,
        reason:
          'ceremonies whose engagement is soft-deleted or never landed (engagement_id is a ' +
          'NOT NULL FK) — verified 2026-08-20',
      },
    ],
  },
  LanguageEngagement: {
    kind: 'migrated',
    extractor: 'engagement',
    table: 'engagements',
    where: "type = 'Language'",
    shortfall: [
      {
        count: 9,
        reason:
          'its share of the 11 engagements under soft-deleted projects (measured 2026-08-24; ' +
          'zero language engagements have a dead or missing language)',
      },
    ],
  },
  InternshipEngagement: {
    kind: 'migrated',
    extractor: 'engagement',
    table: 'engagements',
    where: "type = 'Internship'",
    shortfall: [
      {
        count: 2,
        reason:
          'its share of the 11 engagements under soft-deleted projects (measured 2026-08-24; ' +
          'zero internships have a dead or missing intern)',
      },
    ],
  },
  TranslationProject: {
    kind: 'migrated',
    extractor: 'project',
    table: 'projects',
    where: "type IN ('MomentumTranslation', 'MultiplicationTranslation')",
  },
  MomentumTranslationProject: {
    kind: 'migrated',
    extractor: 'project',
    table: 'projects',
    where: "type = 'MomentumTranslation'",
  },
  MultiplicationTranslationProject: {
    kind: 'migrated',
    extractor: 'project',
    table: 'projects',
    where: "type = 'MultiplicationTranslation'",
  },
  InternshipProject: {
    kind: 'migrated',
    extractor: 'project',
    table: 'projects',
    where: "type = 'Internship'",
  },
  ProjectWorkflowEvent: {
    kind: 'migrated',
    extractor: 'project',
    table: 'project_workflow_events',
    shortfall: [
      {
        count: 11,
        reason:
          'events under soft-deleted projects (measured 2026-08-24; zero events have actor or ' +
          'step problems)',
      },
    ],
  },
  // A second label carried by 5,758 of the 27,535 ProjectWorkflowEvent nodes —
  // the older events, from before the concrete label existed on its own. Found
  // by this check's first run (it was unclaimed), which is the mechanism working.
  WorkflowEvent: structural(
    'co-label on the 5,758 older ProjectWorkflowEvent nodes; those rows migrate via ' +
      'ProjectWorkflowEvent (measured 2026-08-24)',
  ),
  FinancialReport: {
    kind: 'migrated',
    extractor: 'periodic-report',
    table: 'periodic_reports',
    where: "type = 'Financial'",
    shortfall: [
      {
        count: 14,
        reason:
          'reports whose [:report] parent edge points at a soft-deleted project (measured 2026-08-24)',
      },
    ],
  },
  NarrativeReport: {
    kind: 'migrated',
    extractor: 'periodic-report',
    table: 'periodic_reports',
    where: "type = 'Narrative'",
    shortfall: [
      {
        count: 263,
        reason:
          'parent edge points at a soft-deleted project (measured 2026-08-24)',
      },
      {
        count: 13,
        reason:
          'all 13 hang off ONE corrupt node (5e1e0c9b70c6ff879e61353d): a 2020-era internship ' +
          'project that lost its Project labels but kept BaseNode and its properties. The app ' +
          'cannot see it either — every read anchors on :Project — so these reports are already ' +
          'invisible today (measured 2026-08-24)',
      },
    ],
  },
  ProgressReport: {
    kind: 'migrated',
    extractor: 'periodic-report',
    table: 'periodic_reports',
    where: "type = 'Progress'",
    shortfall: [
      {
        count: 6620,
        reason:
          'parent edge points at a soft-deleted engagement (measured 2026-08-24)',
      },
      {
        count: 101,
        reason:
          'reports on the 11 LIVE engagements under soft-deleted projects — the engagement ' +
          'never lands, so its reports cannot either (measured 2026-08-24)',
      },
    ],
  },
  Product: {
    kind: 'migrated',
    extractor: 'product',
    table: 'products',
    to: 'single-table inheritance over the product subtypes',
    shortfall: [
      {
        count: 1878,
        reason:
          'products with no live Project→Engagement→Product chain — verified against the graph 2026-08-20',
      },
    ],
  },
  DirectScriptureProduct: {
    kind: 'migrated',
    extractor: 'product',
    table: 'products',
    where: "type = 'DirectScripture'",
    shortfall: [
      {
        count: 1062,
        reason:
          'its share of the 1,878 products with no live Project→Engagement chain (the interface ' +
          'total was verified against the graph 2026-08-20; the per-type split is this check’s ' +
          'own measurement, 2026-08-24)',
      },
    ],
  },
  DerivativeScriptureProduct: {
    kind: 'migrated',
    extractor: 'product',
    table: 'products',
    where: "type = 'Derivative'",
    shortfall: [
      {
        count: 812,
        reason:
          'its share of the 1,878 chain-dead products — see DirectScriptureProduct',
      },
    ],
  },
  OtherProduct: {
    kind: 'migrated',
    extractor: 'product',
    table: 'products',
    where: "type = 'Other'",
    shortfall: [
      {
        count: 4,
        reason:
          'its share of the 1,878 chain-dead products — see DirectScriptureProduct',
      },
    ],
  },
  Film: {
    kind: 'migrated',
    extractor: 'product',
    table: 'producibles',
    where: "type = 'Film'",
  },
  Story: {
    kind: 'migrated',
    extractor: 'product',
    table: 'producibles',
    where: "type = 'Story'",
  },
  EthnoArt: {
    kind: 'migrated',
    extractor: 'product',
    table: 'producibles',
    where: "type = 'EthnoArt'",
  },
  ProductCompletionDescription: {
    kind: 'migrated',
    extractor: 'product',
    table: 'product_completion_descriptions',
    to: 'deduplicated on (value, methodology) — the source stores repeats',
    shortfall: [
      {
        count: 65,
        reason:
          'source duplicates — 3,941 nodes hold 3,876 distinct (value, methodology) pairs, ' +
          'and the target keeps one row per pair (measured 2026-08-24)',
      },
    ],
  },
  ProductProgress: {
    kind: 'migrated',
    extractor: 'product-progress',
    table: 'product_progress',
    shortfall: [
      {
        count: 19535,
        reason:
          'progress nodes missing a live product or report edge — soft-deleted parents ' +
          '(measured 2026-08-24)',
      },
      {
        count: 283,
        reason:
          'progress under live-labeled parents that never LAND (their product or report was ' +
          'itself dropped): 364,705 − 19,535 = 345,170 read, 344,887 landed (derived 2026-08-24)',
      },
    ],
  },
  StepProgress: {
    kind: 'migrated',
    extractor: 'product-progress',
    table: 'step_progress',
    shortfall: [
      {
        count: 81332,
        reason:
          'steps under the 19,535 progress nodes with soft-deleted parents (measured 2026-08-24)',
      },
      {
        count: 1332,
        reason:
          'steps under the 283 progress rows that never land: 1,560,484 − 81,332 = 1,479,152 ' +
          'on a live path, 1,477,820 landed (derived 2026-08-24; zero steps lack an active ' +
          'inbound step edge)',
      },
    ],
  },
  ProgressSummary: {
    kind: 'migrated',
    extractor: 'progress-summary',
    table: 'progress_summaries',
    shortfall: [
      {
        count: 13,
        reason:
          'summaries whose report edge points at a soft-deleted report (measured 2026-08-24)',
      },
      {
        count: 60,
        reason:
          'summaries under LIVE-labeled reports that never land (the unlanded-report class ' +
          'behind the PeriodicReport shortfall) (measured 2026-08-24)',
      },
    ],
  },
  Comment: { kind: 'migrated', extractor: 'comment', table: 'comments' },
  CommentThread: {
    kind: 'migrated',
    extractor: 'comment',
    table: 'comment_threads',
  },
  Post: {
    kind: 'migrated',
    extractor: 'post',
    table: 'posts',
    shortfall: [
      {
        count: 2,
        reason:
          'posts failing a required read join — a soft-deleted parent or creator, or a missing ' +
          'type/shareability/body property (measured 2026-08-24)',
      },
    ],
  },
  CommentViaMentionNotification: {
    kind: 'migrated',
    extractor: 'notification',
    table: 'notifications',
    where: "type = 'CommentViaMention'",
  },
  Directory: {
    kind: 'migrated',
    extractor: 'file',
    table: 'file_nodes',
    where: "type = 'Directory'",
  },
  File: {
    kind: 'migrated',
    extractor: 'file',
    table: 'file_nodes',
    where: "type = 'File'",
    shortfall: [
      {
        count: 88,
        reason:
          'files whose createdBy user is absent or soft-deleted — created_by_id is NOT NULL ' +
          '(measured 2026-08-24)',
      },
    ],
  },
  FileVersion: {
    kind: 'migrated',
    extractor: 'file',
    table: 'file_nodes',
    where: "type = 'FileVersion'",
    shortfall: [
      {
        count: 1,
        reason:
          'one version with an absent/soft-deleted createdBy user, same rule as File ' +
          '(measured 2026-08-24 — zero versions are missing mimeType or size)',
      },
    ],
  },
  Media: {
    kind: 'migrated',
    extractor: 'media',
    table: 'media',
    shortfall: [
      {
        count: 5,
        reason:
          'media on FileVersions that never land (dead or missing createdBy user) — ' +
          'file_version_id is a real FK (measured 2026-08-24; zero duplicate media per version)',
      },
    ],
  },
  Image: {
    kind: 'migrated',
    extractor: 'media',
    table: 'media',
    where: "type = 'Image'",
    shortfall: [
      {
        count: 5,
        reason:
          'all 5 of the unlanded-FileVersion media are images (measured 2026-08-24)',
      },
    ],
  },
  Video: {
    kind: 'migrated',
    extractor: 'media',
    table: 'media',
    where: "type = 'Video'",
  },
  Audio: {
    kind: 'migrated',
    extractor: 'media',
    table: 'media',
    where: "type = 'Audio'",
  },
  PnpExtractionResult: {
    kind: 'migrated',
    extractor: 'pnpExtractionResult',
    table: 'pnp_extraction_results',
  },
  ProgressReportMedia: {
    kind: 'migrated',
    extractor: 'progressReportMedia',
    table: 'progress_report_media',
    shortfall: [
      {
        count: 3,
        reason:
          'media slots under reports that never land (the unlanded-report class) ' +
          '(measured 2026-08-24; zero slots fail the report/variant-group/creator joins)',
      },
    ],
  },
  ProgressReportVarianceExplanation: {
    kind: 'migrated',
    extractor: 'progress-report-variance-explanation',
    table: 'progress_report_variance_explanations',
    shortfall: [
      {
        count: 2,
        reason:
          'explanations whose report edge points at a soft-deleted report (measured 2026-08-24)',
      },
      {
        count: 4,
        reason:
          'explanations under reports that never land (measured 2026-08-24)',
      },
    ],
  },
  ProgressReportWorkflowEvent: {
    kind: 'migrated',
    extractor: 'progress-report-workflow-event',
    table: 'progress_report_workflow_events',
    shortfall: [
      {
        count: 12,
        reason:
          'events whose report edge points at a soft-deleted report (measured 2026-08-24)',
      },
      {
        count: 47,
        reason:
          'events under reports that never land (measured 2026-08-24; zero events lack a who edge)',
      },
    ],
  },
  ProgressReportCommunityStory: {
    kind: 'migrated',
    extractor: 'prompt-variant-response',
    table: 'prompt_variant_responses',
    where: "resource_type = 'ProgressReportCommunityStory'",
    shortfall: [
      {
        count: 17,
        reason:
          'its share of the 35 responses under dead/never-landing reports (measured 2026-08-24)',
      },
    ],
  },
  ProgressReportHighlight: {
    kind: 'migrated',
    extractor: 'prompt-variant-response',
    table: 'prompt_variant_responses',
    where: "resource_type = 'ProgressReportHighlight'",
  },
  ProgressReportTeamNews: {
    kind: 'migrated',
    extractor: 'prompt-variant-response',
    table: 'prompt_variant_responses',
    where: "resource_type = 'ProgressReportTeamNews'",
    shortfall: [
      {
        count: 18,
        reason:
          'its share of the 35 responses under dead/never-landing reports (measured 2026-08-24)',
      },
    ],
  },
  VariantResponse: {
    kind: 'migrated',
    extractor: 'prompt-variant-response',
    table: 'prompt_variant_response_entries',
    plusLabels: ['Deleted_VariantResponse'],
    to: 'live answers; superseded answers arrive too, with deleted_at set — see Deleted_VariantResponse',
    shortfall: [
      {
        count: 63,
        reason:
          'every answer under the 34 never-landing responses (of the 35 responses whose parent ' +
          'report or creator never lands, 34 have answers). Verified by joining graph-side ' +
          'per-response answer counts against the loaded prompt_variant_responses ids ' +
          '(2026-08-24, cord_cutover_r2). Creator-side losses are ZERO since the property ' +
          'fallback fix: all 86 distinct property-creator ids resolve to loaded users. (The ' +
          'pre-fix figure was 56 — measured through the old required-edge join, which hid the ' +
          '7 property-mechanism answers under these same dead parents)',
      },
    ],
  },
  // Explicit override of the live-only rule: superseded answers are CARRIED,
  // because the source models "superseded" with a deletedAt stamp and the
  // partial unique index on (response_id, variant) is scoped WHERE deleted_at
  // IS NULL — the history is legal and wanted. Counted with VariantResponse.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Deleted_VariantResponse: {
    kind: 'migrated',
    extractor: 'prompt-variant-response',
    to:
      'prompt_variant_response_entries rows with deleted_at set (the answer history). 5,368 of ' +
      'the 9,995 carry the creator as a property instead of an edge; the extractor falls back ' +
      'to it since 2026-08-24 — loads older than that dropped them (see the VariantResponse ' +
      'shortfall and the `creator` property-key entry)',
  },
  VariantGroup: structural(
    'grouping node for progress-report media variants; its id survives as ' +
      'progress_report_media.variant_group_id (a bare NOT NULL text column, no table of its own)',
  ),

  // ── Property storage — Neo4j field records, claimed by their link types ────
  Property: propertyStorage(
    'Neo4j stores each field as its own attached record whose payload is always `value`; ' +
      'the 9,984,914 live records are the field values of everything above',
  ),
  // Explicit rather than rule-derived, because a subset IS read: the
  // engagement extractor reads DEACTIVATED status rels — whose target a
  // supersede relabels to Deleted_Property — to build engagement_status_history.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Deleted_Property: propertyStorage(
    'superseded/deleted field records. Mostly not carried (live-only), EXCEPT the engagement ' +
      'status history: deactivated [:status] rels are read label-free, so the 13,558 superseded ' +
      'status records under live engagements become engagement_status_history rows',
  ),
  BudgetStatus: propertyStorage('budgets.status values'),
  EngagementStatus: propertyStorage(
    'engagements.status values + the superseded ones behind engagement_status_history',
  ),
  ProjectStatus: propertyStorage(
    'the stored project status; Postgres does not carry it as data — projects.status is ' +
      'GENERATED from step, deriving the same value the source derived when writing it',
  ),
  ProjectStep: propertyStorage('projects.step values'),
  ProjectName: propertyStorage('projects.name values'),
  UserName: propertyStorage(
    'user name-field values (users.real_/display_ names)',
  ),
  OrgName: propertyStorage('organizations.name values'),
  LocationName: propertyStorage('locations.name values'),
  LocationType: propertyStorage('locations.type values'),
  LanguageName: propertyStorage('languages.name values'),
  LanguageDisplayName: propertyStorage('languages.display_name values'),
  FieldRegionName: propertyStorage('field_regions.name values'),
  FieldZoneName: propertyStorage('field_zones.name values'),
  FilmName: propertyStorage('producibles.name values (films)'),
  StoryName: propertyStorage('producibles.name values (stories)'),
  EthnoArtName: propertyStorage('producibles.name values (ethno art)'),
  ToolName: propertyStorage('tools.name values'),
  FundingAccountName: propertyStorage('funding_accounts.name values'),
  FundingAccountNumber: propertyStorage(
    'funding_accounts.account_number values',
  ),
  EmailAddress: propertyStorage('users.email values'),
  IsoAlpha3: propertyStorage('locations.iso_alpha3 values'),
  RegistryOfLanguageVarietiesCode: propertyStorage(
    'languages.registry_of_language_varieties_code values',
  ),
  InternPosition: propertyStorage('engagements.position values'),
  ProductMedium: propertyStorage('products.mediums values'),
  ProductMethodology: propertyStorage('products.methodology values'),
  ProductPurpose: propertyStorage('products.purposes values'),
  DepartmentId: propertyStorage('projects.department_id values'),
  ScriptureRange: propertyStorage(
    'verse-id ranges; carried as the {start, end} pairs inside the scripture_references jsonb columns',
  ),
  UnspecifiedScripturePortion: propertyStorage(
    'products.unspecified_scripture_book / _total_verses values',
  ),

  // ── Deliberately not carried — each with its evidence ──────────────────────
  RegistryOfDialectsCode: excluded(
    'renamed to registryOfLanguageVarietiesCode by an app migration (rename-rod-to-rolv). ' +
      'ZERO live nodes remain (22 Deleted_); the 58 surviving edges are the retired history of ' +
      'that rename — every one points at a Deleted_Property or is inactive (measured 2026-08-24)',
  ),
  DuplicateProjectDepartmentId: excluded(
    'quarantined duplicate department-id records: 7 property nodes {createdAt, value} that were ' +
      'relabelled OUT of DepartmentId so each project keeps one value; the surviving DepartmentId ' +
      'record is what migrates (probed 2026-08-24)',
  ),
  PnpProblemType: excluded(
    'the extraction-problem-type registry: 16 nodes {id, name, severity} mirrored from ' +
      'code-defined problem types. Problems carry the type ID into ' +
      'pnp_extraction_result_problems.type; name and severity live in the application registry',
  ),
  SchemaVersion: excluded(
    "Neo4j's own schema-version marker (one node, {value}); Postgres versions its schema " +
      'through drizzle migrations',
  ),
  DataProvenance: excluded(
    "the scrub tooling's provenance marker on this COPY ({scrubbedAt, scrubbedValues, " +
      'deletedKeys, classificationHash}); absent from real production and not application data',
  ),
  Webhook: excluded(
    'zero nodes in the source; the webhooks tables start empty',
  ),
  BroadcastChannel: excluded(
    'zero nodes in the source; the broadcast_channels table starts empty',
  ),
  Changeset: excluded(
    'zero nodes in the source — the changeset feature holds no live changesets, and ' +
      'changeset-pending values are not carried anyway (reads are live-view only)',
  ),
  ProjectChangeRequest: excluded(
    'zero nodes in the source; same feature family as Changeset',
  ),
  Song: excluded(
    'zero nodes; not among the producible types the app defines today (Film/Story/EthnoArt)',
  ),
  LiteracyMaterial: excluded('zero nodes; retired producible type, as Song'),
  LiteracyName: excluded(
    'zero nodes; the name storage for the retired type above',
  ),
  SongName: excluded('zero nodes; the name storage for the retired type above'),

  // ── Decided drops (Rob, 2026-08-24) ─────────────────────────────────────────
  Token: excluded(
    '4,175,608 session tokens ({value, createdAt, active}) — every session ends at cutover and ' +
      'users re-authenticate with their existing password (auth_sessions deliberately starts ' +
      'empty). Decided: drop (Rob, 2026-08-24)',
  ),
  EmailToken: excluded(
    '147 password-reset tokens ({value, createdOn}) — every outstanding reset link breaks at ' +
      'cutover; anyone mid-reset requests a new email. Decided: drop (Rob, 2026-08-24)',
  ),

  ExternalDepartmentId: {
    kind: 'migrated',
    extractor: 'external-department-id',
    table: 'external_department_ids',
    to:
      'external_department_ids — the department IDs Intacct already holds, which must never ' +
      'be assigned to a CORD project. 565 nodes, one bulk import (2025-09-22T21:05:53Z). ' +
      'PORTED (Rob, 2026-08-25, after the team confirmed Intacct is still in use and the ' +
      'reservations still stand). ' +
      // The correction matters more than the disposition. This entry previously
      // read "Nothing in src/ reads the label", and that was simply wrong: the
      // department-ID allocator unions these into the unavailable set on every
      // assignment and has since 2025-09. The nodes ARE fully disconnected, and
      // that is what made them look retired — but a reservation list has
      // nothing to connect to, so disconnected was the correct shape, not a
      // symptom. The lesson for future entries: "no edges" and "no readers" are
      // different claims, and only the second is evidence of being retired.
      'CORRECTION to the earlier entry, which said nothing in src/ read this label: ' +
      'set-department-id.handler.ts reads it on every department-ID assignment. The ' +
      'exclusion was missing from the Postgres arm and is restored in migration 0040 — ' +
      'measured before fixing, 389 of the 565 codes sit inside blocks projects are assigned ' +
      'from, and 2 of 13 blocks would have handed out a different ID than Neo4j on their ' +
      'next project. ' +
      'Separately open, and NOT a cutover item: the list is a one-shot manual load with no ' +
      'refresh path (its importer was never merged to develop), so it is stale against ' +
      'Intacct. Owner of the Intacct side to decide re-export vs real integration.',
  },

  // ── Decided ports (Rob, 2026-08-24) ─────────────────────────────────────────
  ProjectTypeFinancialApprover: {
    kind: 'migrated',
    extractor: 'financial-approver',
    table: 'financial_approvers',
    to:
      'financial_approvers — one row per user (the source node holds ONLY the projectTypes ' +
      'array, so the user is the row identity). Ported, not retired: the project workflow ' +
      'notifies these approvers on five transitions (Rob, 2026-08-24)',
  },
  PnpData: excluded(
    '105 nodes of per-quarter planned/actual figures written onto language engagements by the ' +
      'pre-2022 PnP importer — the retired predecessor of ProgressSummary. Nothing in src/ reads ' +
      'or writes them. Dropped, and this entry states what that gives up rather than pretending ' +
      'it is nothing: 90 rows carry a real year (2020-2021) and the other 15 are importer junk ' +
      '(year and quarter both 0; 6 of the 90 also have an unstamped quarter). They are NOT ' +
      'duplicates of the modern model — checked 2026-08-24 by joining each (engagement, fiscal ' +
      'quarter) to its ProgressReport: only 31 of the 90 have modern ProgressSummary figures at ' +
      'all (just 56 even have the report), and sampled covered rows disagree in value (the ' +
      'modern numbers are later re-extractions, on a 0-1 scale where these are 0-100). So this ' +
      'is a real loss of ~90 historical figures, taken knowingly: management confirmed the ' +
      'legacy figures are not needed (Rob, 2026-08-25), superseding the 2026-08-24 decision to ' +
      'archive them into a pnp_data table. The archive work (migration 0040 + pnp-data.extractor) ' +
      'was written and is recoverable at tag archive/pnp-data if that call is ever reversed. ' +
      'NOTE: this is the retired PnpData label ONLY. The live PnP extraction model is untouched ' +
      '— PnpExtractionResult, engagements.pnp_id, and products.pnp_index all still migrate.',
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// AXIS 2 — relationship types (207). For a property link (an edge pointing at
// a Property record), `migrated` means the VALUE lands in the named column(s).
// For an entity edge, the connection survives as a foreign key or junction row.
// ─────────────────────────────────────────────────────────────────────────────

export const relationshipTypes: Readonly<Record<string, Disposition>> = {
  // ── People / users ──────────────────────────────────────────────────────────
  realFirstName: carried('users.real_first_name'),
  realLastName: carried('users.real_last_name'),
  displayFirstName: carried('users.display_first_name'),
  displayLastName: carried('users.display_last_name'),
  email: carried('users.email'),
  phone: carried('users.phone'),
  about: carried('users.about'),
  timezone: carried('users.timezone'),
  gender: carried('users.gender'),
  title: carried('users.title / products.title (OtherProduct)'),
  roles: carried('user_global_roles rows / project_members.roles'),
  education: carried('educations.user_id (the User→Education edge)'),
  degree: carried('educations.degree'),
  major: carried('educations.major'),
  institution: carried('educations.institution'),
  unavailability: carried(
    'unavailabilities.user_id (the User→Unavailability edge)',
  ),
  password: carried('auth_identities.password_hash'),
  pinned: carried('pins rows (edge-stored: user, resource, createdAt)'),
  locations: carried(
    'user_locations / organization_locations / language_locations junction rows',
  ),
  organization: carried(
    'user_organizations rows / partners.organization_id / budget_records.organization_id',
  ),
  primaryOrganization: carried('user_organizations.primary'),

  // ── Projects ────────────────────────────────────────────────────────────────
  name: carried(
    'the name column of each owning entity (projects, languages, orgs, …) and file_nodes.name',
  ),
  step: carried(
    'projects.step (the property records) and step_progress rows (the ProductProgress→StepProgress edges)',
  ),
  status: carried(
    'the status columns: users, budgets, engagements (+ engagement_status_history from ' +
      'deactivated rels), periodic_reports. projects.status is GENERATED from step in Postgres',
  ),
  stepChangedAt: carried(
    'derived, not stored: the Postgres read side serves stepChangedAt from the latest ' +
      'project_workflow_events.at per project (project.drizzle.repository)',
  ),
  mouStart: carried('projects.mou_start'),
  mouEnd: carried('projects.mou_end'),
  initialMouEnd: carried('projects.initial_mou_end'),
  estimatedSubmission: carried('projects.estimated_submission'),
  financialReportReceivedAt: carried('projects.financial_report_received_at'),
  financialReportPeriod: carried('projects.financial_report_period'),
  departmentId: carried('projects.department_id'),
  rev79ProjectId: carried('projects.rev79_project_id'),
  presetInventory: carried('projects.preset_inventory'),
  tags: carried('projects.tags / languages.tags'),
  sensitivity: carried(
    'projects.sensitivity + projects.own_sensitivity / languages.sensitivity',
  ),
  primaryLocation: carried('projects.primary_location_id'),
  marketingLocation: carried('projects.marketing_location_id'),
  fieldRegion: carried('projects.field_region_id'),
  owningOrganization: carried('projects.owning_organization_id'),
  rootDirectory: carried('projects.root_directory_id'),
  member: structural(
    'the Project→ProjectMember edge; survives as project_members.project_id',
  ),
  user: structural(
    'the ProjectMember→User (and sibling) edges; survive as the user_id foreign keys',
  ),
  inactiveAt: carried('project_members.inactive_at'),
  workflowEvent: structural(
    'the parent→event edges; survive as project_workflow_events.project_id / ' +
      'progress_report_workflow_events.report_id',
  ),
  who: carried(
    'project_workflow_events.who / .who_system_agent_id and progress_report_workflow_events.who',
  ),
  modifiedAt: carried(
    'the modified_at / updated_at columns, where the source stores modification time as a property record',
  ),

  // ── Engagements ─────────────────────────────────────────────────────────────
  engagement: structural(
    'the Project→Engagement edge; survives as engagements.project_id',
  ),
  language: carried('engagements.language_id'),
  intern: carried('engagements.intern_id'),
  mentor: carried('engagements.mentor_id'),
  countryOfOrigin: carried('engagements.country_of_origin_id'),
  position: carried('engagements.position'),
  methodologies: carried('engagements.methodologies'),
  startDateOverride: carried('engagements.start_date_override'),
  endDateOverride: carried('engagements.end_date_override'),
  initialEndDate: carried('engagements.initial_end_date'),
  completeDate: carried('engagements.complete_date'),
  disbursementCompleteDate: carried('engagements.disbursement_complete_date'),
  statusModifiedAt: carried('engagements.status_modified_at'),
  lastSuspendedAt: carried('engagements.last_suspended_at'),
  lastReactivatedAt: carried('engagements.last_reactivated_at'),
  paratextRegistryId: carried('engagements.paratext_registry_id'),
  rev79CommunityId: carried('engagements.rev79_community_id'),
  webId: carried('engagements.web_id'),
  firstScripture: carried('engagements.first_scripture'),
  lukePartnership: carried('engagements.luke_partnership'),
  openToInvestorVisit: carried('engagements.open_to_investor_visit'),
  sentPrintingDate: carried('engagements.sent_printing_date'),
  historicGoal: carried('engagements.historic_goal'),
  milestonePlanned: carried('engagements.milestone_planned'),
  milestoneReached: carried('engagements.milestone_reached'),
  usingAIAssistedTranslation: carried(
    'engagements.using_ai_assisted_translation',
  ),
  marketable: carried('engagements.marketable'),
  pnp: carried('engagements.pnp_id (DefinedFile placeholder id)'),
  pnpNode: structural('duplicate edge to the same File the pnp link names'),
  growthPlan: carried(
    'engagements.growth_plan_id (DefinedFile placeholder id)',
  ),
  growthPlanNode: structural(
    'duplicate edge to the same File the growthPlan link names',
  ),
  ceremony: structural(
    'the Engagement→Ceremony edge; survives as ceremonies.engagement_id',
  ),
  actualDate: carried('ceremonies.actual_date'),
  estimatedDate: carried('ceremonies.estimated_date'),
  planned: carried('ceremonies.planned'),
  description: carried(
    'the description columns: engagements (rich text), products, tools, unavailabilities',
  ),

  // ── Decided 2026-08-24 ──────────────────────────────────────────────────────
  communicationsCompleteDate: excluded(
    'a RETIRED engagement field nothing in src/ reads or writes — and all 35 live-labeled ' +
      'records hold NULL (count(p.value) = 0, probed 2026-08-24), so dropping it loses ' +
      'literally nothing. Decided: drop (Rob, 2026-08-24)',
  ),
  pnpData: excluded(
    'the LanguageEngagement→PnpData edges — dropped with the PnpData label (Rob, 2026-08-25)',
  ),
  token: excluded(
    'the User→Token session edges (223,387) — dropped with the Token label (Rob, 2026-08-24)',
  ),

  // ── Languages ───────────────────────────────────────────────────────────────
  displayName: carried('languages.display_name'),
  displayNamePronunciation: carried('languages.display_name_pronunciation'),
  isDialect: carried('languages.is_dialect'),
  isSignLanguage: carried('languages.is_sign_language'),
  signLanguageCode: carried('languages.sign_language_code'),
  leastOfThese: carried('languages.least_of_these'),
  leastOfTheseReason: carried('languages.least_of_these_reason'),
  populationOverride: carried('languages.population_override'),
  registryOfLanguageVarietiesCode: carried(
    'languages.registry_of_language_varieties_code',
  ),
  registryOfDialectsCode: excluded(
    'the retired pre-rename field (renamed to registryOfLanguageVarietiesCode by an app ' +
      'migration); all 58 surviving edges are the rename’s retired history — every one is ' +
      'inactive or points at a Deleted_Property (measured 2026-08-24)',
  ),
  sponsorEstimatedEndDate: carried('languages.sponsor_estimated_end_date'),
  hasExternalFirstScripture: carried('languages.has_external_first_scripture'),
  isAvailableForReporting: carried('languages.is_available_for_reporting'),
  ethnologue: structural(
    'the Language→EthnologueLanguage edge; survives as ethnologue_languages.language_id (backfilled)',
  ),
  code: carried('ethnologue_languages.code'),
  provisionalCode: carried('ethnologue_languages.provisional_code'),
  population: carried('ethnologue_languages.population'),

  // ── Field zones / regions / locations / funding ─────────────────────────────
  zone: carried('field_regions.field_zone_id'),
  director: carried('field_zones.director_id / field_regions.director_id'),
  fundingAccount: carried('locations.funding_account_id'),
  defaultFieldRegion: carried('locations.default_field_region_id'),
  defaultMarketingRegion: carried('locations.default_marketing_region_id'),
  isoAlpha3: carried('locations.iso_alpha3'),
  mapImage: carried('locations.map_image_id (DefinedFile placeholder id)'),
  mapImageNode: structural(
    'duplicate edge to the same File the mapImage link names',
  ),
  accountNumber: carried('funding_accounts.account_number'),
  departmentIdBlock: carried(
    'funding_accounts.department_id_block_id / partners.department_id_block_id',
  ),

  // ── Organizations / partners / partnerships ─────────────────────────────────
  acronym: carried('organizations.acronym'),
  address: carried('organizations.address / partners.address'),
  reach: carried('organizations.reach'),
  types: carried('organizations.types / partners.types / partnerships.types'),
  active: carried(
    'partners.active (a property link, unlike the `active` EDGE FLAG below)',
  ),
  pmcEntityCode: carried('partners.pmc_entity_code'),
  globalInnovationsClient: carried('partners.global_innovations_client'),
  pointOfContact: carried('partners.point_of_contact_id'),
  startDate: carried('partners.start_date / tool_usages.start_date'),
  approvedPrograms: carried('partners.approved_programs'),
  financialReportingTypes: carried('partners.financial_reporting_types'),
  fieldRegions: carried('partner_field_regions junction rows'),
  countries: carried('partner_countries junction rows'),
  partner: carried('partnerships.partner_id'),
  partnership: structural(
    'the Project→Partnership edge; survives as partnerships.project_id',
  ),
  agreementStatus: carried('partnerships.agreement_status'),
  mouStatus: carried('partnerships.mou_status'),
  mou: carried('partnerships.mou_id (DefinedFile placeholder id)'),
  mouNode: structural('duplicate edge to the same File the mou link names'),
  agreement: carried('partnerships.agreement_id (DefinedFile placeholder id)'),
  agreementNode: structural(
    'duplicate edge to the same File the agreement link names',
  ),
  mouStartOverride: carried('partnerships.mou_start_override'),
  mouEndOverride: carried('partnerships.mou_end_override'),
  financialReportingType: carried('partnerships.financial_reporting_type'),
  primary: carried('partnerships.primary'),
  PartnershipProducingMedium: carried(
    'partnership_producing_mediums rows (edge-stored; medium + createdAt live on the edge)',
  ),

  // ── Budgets ─────────────────────────────────────────────────────────────────
  budget: structural('the Project→Budget edge; survives as budgets.project_id'),
  universalTemplateFile: carried(
    'budgets.universal_template_file_id (DefinedFile placeholder id)',
  ),
  universalTemplateFileNode: structural(
    'duplicate edge to the same File the universalTemplateFile link names',
  ),
  record: structural(
    'the Budget→BudgetRecord edge; survives as budget_records.budget_id',
  ),
  fiscalYear: carried('budget_records.fiscal_year'),
  amount: carried('budget_records.amount'),
  initialAmount: carried('budget_records.initial_amount'),
  preApprovedAmount: carried('budget_records.pre_approved_amount'),

  // ── Products / producibles / progress ───────────────────────────────────────
  product: structural(
    'the Engagement→Product edge; survives as products.engagement_id',
  ),
  mediums: carried('products.mediums'),
  purposes: carried('products.purposes'),
  methodology: carried('products.methodology'),
  steps: carried('products.steps'),
  describeCompletion: carried('products.describe_completion'),
  placeholderDescription: carried('products.placeholder_description'),
  progressStepMeasurement: carried('products.progress_step_measurement'),
  progressTarget: carried('products.progress_target'),
  produces: carried('products.produces_id'),
  isOverriding: carried(
    'encoded into products.scripture_references_override: null means not overriding',
  ),
  composite: carried('products.composite'),
  totalVerses: carried('products.total_verses'),
  totalVerseEquivalents: carried('products.total_verse_equivalents'),
  scriptureReferences: carried(
    'products.scripture_references / producibles.scripture_references (jsonb verse ranges)',
  ),
  scriptureReferencesOverride: carried(
    'products.scripture_references_override',
  ),
  unspecifiedScripture: carried(
    'products.unspecified_scripture_book + _total_verses',
  ),
  progress: structural(
    'the Product→ProductProgress and PeriodicReport→ProductProgress edges; survive as ' +
      'product_progress.product_id / .report_id',
  ),
  completed: carried('step_progress.completed'),

  // ── Reports and their attachments ───────────────────────────────────────────
  report: structural(
    'the parent→PeriodicReport edge; survives as periodic_reports.project_id / .engagement_id',
  ),
  start: carried('periodic_reports.start / unavailabilities.start'),
  end: carried('periodic_reports.end / unavailabilities.end'),
  type: carried(
    'the discriminators stored as property records: periodic_reports.type, ceremonies.type, posts.type',
  ),
  receivedDate: carried('periodic_reports.received_date'),
  skippedReason: carried('periodic_reports.skipped_reason'),
  reportFile: carried(
    'periodic_reports.report_file_id (DefinedFile placeholder id)',
  ),
  reportFileNode: structural(
    'duplicate edge to the same File the reportFile link names',
  ),
  narrativeFile: carried(
    'periodic_reports.narrative_file_id (DefinedFile placeholder id)',
  ),
  narrativeFileNode: structural(
    'duplicate edge to the same File the narrativeFile link names',
  ),
  narrativeReceivedDate: carried('periodic_reports.narrative_received_date'),
  summary: carried(
    'progress_summaries rows (period/planned/actual sit on the target node)',
  ),
  varianceExplanation: carried('progress_report_variance_explanations rows'),
  reasons: carried('progress_report_variance_explanations.reasons'),
  comments: carried('progress_report_variance_explanations.comments'),
  child: structural(
    'parent→child edges (report→media, variant-group→media, prompt-response→answer); ' +
      'survive as report_id / variant_group_id / response_id',
  ),
  prompt: carried('prompt_variant_responses.prompt'),

  // ── Comments / posts / notifications / pins ─────────────────────────────────
  commentThread: structural(
    'the parent→CommentThread edge; survives as comment_threads.parent_id + parent_type',
  ),
  comment: structural(
    'the CommentThread→Comment and Notification→Comment edges; survive as comments.thread_id ' +
      'and notifications.comment_id',
  ),
  body: carried('posts.body (plain text) / comments.body (rich text jsonb)'),
  shareability: carried('posts.shareability'),
  post: structural(
    'the parent→Post edge; survives as posts.parent_id + parent_type',
  ),
  creator: carried(
    'the creator_id columns (posts, comments, threads, tool usages, prompt responses, media slots, notifications)',
  ),

  // ── Files / media / PnP extraction ──────────────────────────────────────────
  parent: carried('file_nodes.parent_id (the file tree)'),
  createdBy: carried('file_nodes.created_by_id'),
  public: carried(
    'file_nodes.public (tri-state; null inherits from the parent)',
  ),
  mimeType: carried('file_nodes.mime_type (file versions)'),
  size: carried('file_nodes.size (file versions)'),
  media: structural(
    'the FileVersion→Media edge; survives as media.file_version_id',
  ),
  photo: carried('users.photo_id (DefinedFile placeholder id)'),
  photoNode: structural('duplicate edge to the same File the photo link names'),
  fileNode: carried(
    'progress_report_media.file_id (DefinedFile placeholder id)',
  ),
  pnpExtractionResult: structural(
    'the File→PnpExtractionResult edge; survives as pnp_extraction_results.file_id',
  ),
  problem: carried(
    'pnp_extraction_result_problems rows ({id, source, context} live on the edge; type is the target node’s id)',
  ),

  // ── Tools ───────────────────────────────────────────────────────────────────
  key: carried('tools.key'),
  aiBased: carried('tools.ai_based'),
  uses: structural(
    'the container→ToolUsage edge; survives as tool_usages.container_id + container_type',
  ),
  tool: carried('tool_usages.tool_id'),

  // ── Department-id / finance config ──────────────────────────────────────────
  financialApprover: carried(
    'financial_approvers.user_id — the edge target IS the row identity (ported, Rob 2026-08-24)',
  ),

  // ── Neo4j-side mechanics, deliberately not carried ──────────────────────────
  canDelete: excluded(
    'Neo4j-side delete-permission flag written on every entity (1,280,074 records); Postgres ' +
      'derives delete rights from the policy engine, so there is nothing to carry',
  ),
  changeset: excluded(
    'changeset bookkeeping edges on engagement property records (591, incl. 46 on deleted ' +
      'engagements). The graph holds ZERO Changeset nodes, and changeset-pending values are not ' +
      'carried — reads are live-view only (probed 2026-08-24)',
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// AXIS 3 — property keys (85). The least obvious axis and the one that catches
// FIELD-level loss. `db.propertyKeys()` returns every key EVER minted, so a key
// can be claimed `excluded` on the measured fact that nothing carries it.
// ─────────────────────────────────────────────────────────────────────────────

export const propertyKeys: Readonly<Record<string, Disposition>> = {
  // ── The core storage mechanics ─────────────────────────────────────────────
  value: carried(
    'the payload every field record holds; lands in the column its LINK names — see the ' +
      'relationship-type manifest, which claims each link',
  ),
  id: carried(
    'the id columns — ids are preserved verbatim across the migration',
  ),
  createdAt: carried(
    'the created_at columns (nodes) and edge timestamps (pins, junctions)',
  ),
  modifiedAt: carried(
    'the modified_at / updated_at columns where stored directly on a node',
  ),
  deletedAt: carried(
    'deleted_at where the target table keeps history (prompt_variant_response_entries); ' +
      'otherwise the marker of rows the live-only rule excludes',
  ),
  active: propertyStorage(
    'the liveness flag on relationships — Neo4j’s way of superseding a value without ' +
      'deleting it. Postgres has no equivalent because current-vs-history is modeled in rows',
  ),
  sortValue: propertyStorage(
    'a derived sort key on Property records; Postgres re-derives ordering with collation and indexes',
  ),
  // Soft-delete renames a field record's id/value to deleted_id/deleted_value.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  deleted_id: propertyStorage(
    'the id of a soft-deleted field record (renamed on delete)',
  ),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  deleted_value: propertyStorage(
    'the value of a soft-deleted field record (renamed on delete); not carried — live-only',
  ),
  property: excluded(
    'zero occurrences on any node or relationship (full scans 2026-08-24) — a token-store ' +
      'ghost from an older schema',
  ),

  // ── Values living directly on nodes/edges, and where they land ─────────────
  name: carried(
    'system_agents.name (+ PnpProblemType registry names, which live in code)',
  ),
  status: carried('project/progress-report workflow event status columns'),
  step: carried('step_progress.step'),
  to: carried(
    'project_workflow_events.to_step (from_step is derived while loading)',
  ),
  transition: carried('the workflow events’ transition_key columns'),
  notes: carried('the workflow events’ notes columns (rich text jsonb)'),
  variant: carried(
    'prompt_variant_response_entries.variant / progress_report_media.variant / product_progress.variant',
  ),
  response: carried(
    'prompt_variant_response_entries.response (rich text jsonb)',
  ),
  period: carried('progress_summaries.period'),
  planned: carried('progress_summaries.planned'),
  actual: carried('progress_summaries.actual'),
  category: carried('progress_report_media.category'),
  medium: carried('partnership_producing_mediums.medium (lives on the edge)'),
  methodology: carried('product_completion_descriptions.methodology'),
  lastUsedAt: carried('product_completion_descriptions.last_used_at'),
  type: carried(
    'media.type, notifications.type, and the engagement/project type discriminators',
  ),
  mimeType: carried(
    'media.mime_type (direct property; file versions store theirs as a field record)',
  ),
  caption: carried('media.caption'),
  duration: carried('media.duration'),
  height: carried('media.height'),
  width: carried('media.width'),
  message: carried('notifications.message'),
  readAt: carried(
    'notification_recipients.read_at (on the recipient edge; zero edges in prod today)',
  ),
  start: carried(
    'the {start, end} verse bounds inside the scripture_references jsonb',
  ),
  end: carried('as start — the other verse bound'),
  book: carried('products.unspecified_scripture_book'),
  totalVerses: carried('products.unspecified_scripture_total_verses'),
  blocks: carried('department_id_blocks.range (JSON ranges → int4multirange)'),
  programs: carried('department_id_blocks.programs'),
  // Two different nodes carry this key and both are migrated: the Property
  // record behind a project's departmentId, and the ExternalDepartmentId
  // reservation nodes. Named here because a single property-key entry cannot
  // say "per label", and one destination would have hidden the other.
  departmentId: carried(
    'projects.department_id (where stored directly), and ' +
      'external_department_ids.department_id for the ExternalDepartmentId nodes',
  ),
  key: carried('tools.key (where stored directly)'),
  source: carried('pnp_extraction_result_problems.source'),
  context: carried(
    'pnp_extraction_result_problems.context (JSON string → jsonb)',
  ),
  severity: excluded(
    'lives only on the 16 PnpProblemType registry nodes ({id, name, severity}); the registry ' +
      'is code-defined in Postgres, problems carry only the type id (probed 2026-08-24)',
  ),
  roles: carried(
    'system_agents.roles / user_global_roles / project_members.roles (where stored directly)',
  ),
  pnpIndex: carried('products.pnp_index'),

  // ── Scrub tooling markers — exist only on this copy, never in production ───
  scrubbedAt: excluded(
    'scrub provenance marker on the DataProvenance node of this COPY',
  ),
  scrubbedValues: excluded('scrub provenance marker, as scrubbedAt'),
  deletedKeys: excluded('scrub provenance marker, as scrubbedAt'),
  classificationHash: excluded('scrub provenance marker, as scrubbedAt'),

  // ── Dead 2021-migration artifacts (the scrub deletes these outright) ───────
  '87SixId': excluded(
    'join key for the Aug-2021 import from 87Six, the system Cord v3 replaced; nothing reads it',
  ),
  v2User: excluded(
    'old-system actor id from the same 2021 import; nothing reads it',
  ),
  v2Timestamp: excluded('old-system timestamp from the same 2021 import'),
  finalReportMigration: excluded(
    'rollback marker from the 2021 effort; one distinct value',
  ),
  postMigration: excluded(
    'rollback marker from the 2021 effort; never reverted',
  ),
  commentDescription: excluded('87Six leftovers; verified 0 live values'),
  commentPrayerNeeds: excluded('87Six leftovers; verified 0 live values'),
  commentProposalComments: excluded('87Six leftovers; verified 0 live values'),
  migrated: excluded('migration bookkeeping marker; not data'),
  migration: excluded('migration bookkeeping marker; not data'),
  primarySchemaUpdateAt: excluded(
    'schema bookkeeping on the SchemaVersion node',
  ),

  // ── Sessions / credentials — dropped with the Token/EmailToken decisions ───
  createdOn: excluded(
    'lives only on EmailToken nodes — dropped with EmailToken (Rob, 2026-08-24)',
  ),
  valid: excluded(
    'zero occurrences on any node or relationship (full scans 2026-08-24); token-store ghost',
  ),
  token: excluded(
    'zero occurrences on any node or relationship (full scans 2026-08-24) — session tokens ' +
      'store their value under `value`; this key is a token-store ghost',
  ),
  secret: excluded(
    'webhook signing secrets — zero occurrences (webhooks hold zero nodes in the source)',
  ),
  subscription: excluded(
    'webhook GraphQL documents — zero occurrences, as secret',
  ),
  url: excluded('webhook target URLs — zero occurrences, as secret'),

  // ── Measured-dead keys, each probed 2026-08-24 ─────────────────────────────
  powers: excluded(
    'the pre-policy-engine authorization grants, stored on 1,243 live User nodes. The current ' +
      'system computes powers from code-defined policies (authorization.resolver reads ' +
      'privileges.powers, never this property); no repository reads it',
  ),
  originalParentId: excluded(
    'pre-move parent bookkeeping on 705 live FileVersions (+626 Property records); ZERO ' +
      'references in src/ outside the scrub classification — the live tree is carried via parent edges',
  ),
  creator: carried(
    'prompt_variant_response_entries.creator_id — the OLD creator mechanism (a creator id ' +
      'stored as a node property, on 5,368 retired answers with no [:creator] edge). The ' +
      'extractor coalesces edge-then-property since 2026-08-24, after cutover-coverage caught ' +
      'the required-edge join dropping 54% of the answer history (Rob: fix, 2026-08-24). The ' +
      '91 occurrences on deleted media slots stay uncarried — live-only',
  ),
  hadNaN: excluded(
    'a "spreadsheet cell was NaN" marker the old PnP importer stamped on progress field ' +
      'records; 1 live occurrence (59 on deleted records); nothing reads it',
  ),
  read: excluded(
    'the pre-readAt read-state key; zero occurrences on any node or relationship — production ' +
      'has zero notification recipient edges at all',
  ),
  edit: excluded(
    'zero occurrences on any node or relationship (full scans 2026-08-24)',
  ),
  role: excluded(
    'zero occurrences on any node or relationship (full scans 2026-08-24)',
  ),
  countError: excluded(
    'the OLD denormalized PnP-extraction schema; save() clears it ({result: {}}), and full ' +
      'scans 2026-08-24 found zero occurrences — problems now live on edges',
  ),
  countNotice: excluded('as countError — zero occurrences'),
  countWarning: excluded('as countError — zero occurrences'),
  hasError: excluded('as countError — zero occurrences'),
  hasNotice: excluded('as countError — zero occurrences'),
  hasWarning: excluded('as countError — zero occurrences'),
  problems: excluded(
    'as countError — zero occurrences; problems live on [:problem] edges',
  ),

  // ── PnpData figures — dropped with the PnpData label (Rob, 2026-08-25) ─────
  // All five live ONLY on PnpData nodes: no other extractor reads any of them,
  // and the modern equivalents are separate keys on ProgressSummary/Product.
  // The figures themselves are the loss the PnpData label entry describes.
  quarter: excluded('a PnpData figure — dropped with that label'),
  year: excluded('a PnpData figure — dropped with that label'),
  progressActual: excluded('a PnpData figure — dropped with that label'),
  progressPlanned: excluded('a PnpData figure — dropped with that label'),
  variance: excluded('a PnpData figure — dropped with that label'),

  // ── Config nodes ────────────────────────────────────────────────────────────
  projectTypes: carried(
    'financial_approvers.project_types (ported with the label, Rob 2026-08-24)',
  ),
};
