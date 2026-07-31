/**
 * Scrub classification — the single source of truth for what a production copy
 * is allowed to expose.
 *
 * WHY THIS FILE IS AN ALLOWLIST. Neo4j stores each field as its own attached
 * `:Property` record whose payload is *always* called `value`. The only thing
 * distinguishing a name from an email from a password is the **relationship type
 * pointing at it**. So classification is keyed on link name, not field name —
 * `db.propertyKeys()` returns 81 keys but one of them (`value`) carries nearly
 * all the real content.
 *
 * Everything the live graph contains must appear below. `assertFullyClassified`
 * compares this file against `db.relationshipTypes()` and `db.propertyKeys()` and
 * THROWS on anything unlisted, so the scrub refuses to run rather than silently
 * skipping a field nobody classified. That inverted failure mode is the whole
 * point: a blocklist leaks whatever you forgot and never tells you.
 *
 * `review` entries also block. An unanswered question is not a default to `safe`.
 *
 * Two further rules the scrub itself enforces, recorded here because they are
 * easy to lose:
 *  - Replace, never blank. Nulls break what the migration test measures —
 *    project names carry a uniqueness constraint and a null one already aborted a
 *    load. Fakes must be valid, unique where the original was unique, and of
 *    comparable length. Rich text keeps its document structure; only the words
 *    inside change.
 *  - Deterministic, never random. The same input must always produce the same
 *    fake, so monthly refreshes stay stable (a person keeps their fake name, so
 *    bookmarks and screenshots still make sense) and two runs stay comparable.
 */

/** How a replacement value is generated. All are deterministic in the input. */
export type Strategy =
  /** Person names — first/last/display, and the derived initials. */
  | 'personName'
  /** Names of organizations, projects, places, tools, funding accounts. */
  | 'entityName'
  /**
   * Language names and pronunciations. Separate from `entityName` because the
   * protocol treats language data supplied by a community differently from an
   * org's trading name, and because a reviewer should be able to see at a glance
   * which fields are the community-data ones.
   */
  | 'languageName'
  | 'email'
  | 'phone'
  | 'address'
  /** Single-line free text a person wrote. Length-comparable. */
  | 'prose'
  /** A RichTextDocument. Structure preserved, block text replaced. */
  | 'richText'
  /**
   * Emptied, not faked. Fake credentials still read as credentials, and a
   * plausible-looking one invites someone to try it. See `credentialLinks`.
   */
  | 'credential';

export type Action =
  /** Points at another record. No stored value, nothing to scrub. */
  | { kind: 'structural' }
  /** Holds a value that carries nothing protected. `why` is required. */
  | { kind: 'safe'; why: string }
  | { kind: 'scrub'; as: Strategy; note?: string }
  /** Removed outright. Better than scrubbing — absent data cannot leak. */
  | { kind: 'delete'; why: string }
  /** BLOCKS the scrub. Someone must decide before a copy can be made. */
  | { kind: 'review'; question: string };

const structural: Action = { kind: 'structural' };
const safe = (why: string): Action => ({ kind: 'safe', why });
const scrub = (as: Strategy, note?: string): Action => ({
  kind: 'scrub',
  as,
  note,
});

/**
 * Relationship types (207 in production as of 2026-07-31).
 *
 * Most are structural — the connections that make up the graph. Only the ones
 * pointing at a `:Property` carry a value, and only some of those matter.
 */
export const links: Readonly<Record<string, Action>> = {
  // ── People ────────────────────────────────────────────────────────────────
  realFirstName: scrub('personName'),
  realLastName: scrub('personName'),
  displayFirstName: scrub('personName'),
  displayLastName: scrub('personName'),
  email: scrub('email'),
  phone: scrub('phone'),
  about: scrub('prose', 'User bio, free text'),
  title: scrub('prose', 'job title'),
  position: scrub('prose'),
  degree: scrub('prose', 'Education'),
  major: scrub('prose', 'Education'),
  institution: scrub('entityName', 'Education'),
  timezone: safe('IANA zone name, coarse and non-identifying'),

  // ── Entity names ──────────────────────────────────────────────────────────
  name: scrub(
    'entityName',
    'polymorphic — project, org, partner, location, tool, zone, region, funding account, producible',
  ),
  acronym: scrub('entityName'),
  address: scrub('address', 'Organization postal address'),

  // ── Language data ─────────────────────────────────────────────────────────
  displayName: scrub('languageName', 'Language.displayName'),
  displayNamePronunciation: scrub('languageName'),

  // ── Free text people wrote ────────────────────────────────────────────────
  body: scrub(
    'richText',
    'Comment body — Post.body is plain text, same handler',
  ),
  comments: scrub('richText', 'variance explanation'),
  description: scrub('prose'),
  describeCompletion: scrub('prose'),
  historicGoal: scrub('prose'),
  leastOfTheseReason: scrub('prose'),
  placeholderDescription: scrub('prose'),
  skippedReason: scrub('prose'),
  prompt: safe('prompt text is app-authored, not user content'),
  reasons: safe('fixed option set, app-level enum in all but type'),

  // ── Credentials — emptied, and done in a separate first pass ──────────────
  password: scrub(
    'credential',
    'reset to one known dev value, see credentialLinks',
  ),
  token: scrub(
    'credential',
    'session + password-reset tokens are LIVE in a dump',
  ),

  // ── Dead 2021 artifacts — delete, do not classify ─────────────────────────
  // 87Six was the system Cord v3 replaced. Commits cc389c2a8 / 6143fc3e0
  // (Aug 2021) imported its comments into Cord posts and left rollback markers
  // behind. The rollback never happened. Nothing reads any of these.
  // (`87SixId`, `v2User`, `finalReportMigration`, `postMigration` are direct
  // node properties — see `properties` below.)

  // ── Identifiers and codes ─────────────────────────────────────────────────
  departmentId: safe(
    'finance code, carries a uniqueness test the migration measures',
  ),
  pmcEntityCode: safe('internal entity code'),
  webId: safe('internal reference'),
  paratextRegistryId: safe('external tool reference, not personal'),
  rev79ProjectId: safe('external system reference, not personal'),
  rev79CommunityId: safe('external system reference, not personal'),
  isoAlpha3: safe('published ISO country code'),
  key: safe('Tool key, a slug'),

  // ── Dates ─────────────────────────────────────────────────────────────────
  start: safe('date'),
  end: safe('date'),
  startDate: safe('date'),
  startDateOverride: safe('date'),
  endDateOverride: safe('date'),
  actualDate: safe('date'),
  estimatedDate: safe('date'),
  estimatedSubmission: safe('date'),
  completeDate: safe('date'),
  communicationsCompleteDate: safe('date'),
  disbursementCompleteDate: safe('date'),
  sentPrintingDate: safe('date'),
  receivedDate: safe('date'),
  narrativeReceivedDate: safe('date'),
  initialEndDate: safe('date'),
  sponsorEstimatedEndDate: safe('date'),
  mouStart: safe('date'),
  mouEnd: safe('date'),
  mouStartOverride: safe('date'),
  mouEndOverride: safe('date'),
  initialMouEnd: safe('date'),
  financialReportReceivedAt: safe('date'),
  inactiveAt: safe('date'),
  lastSuspendedAt: safe('date'),
  lastReactivatedAt: safe('date'),
  statusModifiedAt: safe('date'),
  stepChangedAt: safe('date'),
  modifiedAt: safe('date'),
  fiscalYear: safe('year'),

  // ── Statuses, enums, flags ────────────────────────────────────────────────
  status: safe('enum'),
  step: safe('enum'),
  type: safe('enum'),
  types: safe('enum list'),
  sensitivity: safe('enum — and the migration test depends on it'),
  shareability: safe('enum'),
  methodology: safe('enum'),
  methodologies: safe('enum list'),
  mediums: safe('enum list'),
  purposes: safe('enum list'),
  roles: safe('enum list'),
  agreementStatus: safe('enum'),
  mouStatus: safe('enum'),
  financialReportPeriod: safe('enum'),
  financialReportingType: safe('enum'),
  financialReportingTypes: safe('enum list'),
  approvedPrograms: safe('enum list'),
  progressStepMeasurement: safe('enum'),
  reach: safe('enum'),
  active: safe('boolean'),
  primary: safe('boolean'),
  public: safe('boolean'),
  canDelete: safe('boolean'),
  completed: safe('number or boolean'),
  composite: safe('boolean'),
  marketable: safe('boolean'),
  presetInventory: safe('boolean'),
  leastOfThese: safe('boolean'),
  globalInnovationsClient: safe('boolean'),
  openToInvestorVisit: safe('boolean'),
  isDialect: safe('boolean'),
  isSignLanguage: safe('boolean'),
  isOverriding: safe('boolean'),
  isAvailableForReporting: safe('boolean'),
  hasExternalFirstScripture: safe('boolean'),
  aiBased: safe('boolean'),
  usingAIAssistedTranslation: safe('boolean'),
  lukePartnership: safe('boolean'),
  tags: safe('short app-level labels'),
  mimeType: safe('media type'),
  size: safe('byte count'),

  // ── Numbers and measurements ──────────────────────────────────────────────
  population: safe('language population estimate, aggregate'),
  populationOverride: safe('aggregate'),
  totalVerses: safe('count'),
  totalVerseEquivalents: safe('count'),
  unspecifiedScripture: safe('count'),
  progressTarget: safe('number'),
  planned: safe('number'),
  milestonePlanned: safe('number'),
  milestoneReached: safe('number'),

  // ── Structural — connections to other records ─────────────────────────────
  PartnershipProducingMedium: structural,
  agreement: structural,
  agreementNode: structural,
  budget: structural,
  ceremony: structural,
  changeset: structural,
  child: structural,
  comment: structural,
  commentThread: structural,
  countries: structural,
  countryOfOrigin: structural,
  createdBy: structural,
  creator: safe(
    'either a User link or a Property holding a user id — an id either way',
  ),
  defaultFieldRegion: structural,
  defaultMarketingRegion: structural,
  departmentIdBlock: structural,
  director: structural,
  education: structural,
  engagement: structural,
  ethnologue: structural,
  fieldRegion: structural,
  fieldRegions: structural,
  fileNode: structural,
  financialApprover: structural,
  firstScripture: structural,
  fundingAccount: structural,
  growthPlan: structural,
  growthPlanNode: structural,
  intern: structural,
  language: structural,
  locations: structural,
  mapImage: structural,
  mapImageNode: structural,
  marketingLocation: structural,
  media: structural,
  member: structural,
  mentor: structural,
  mou: structural,
  mouNode: structural,
  narrativeFile: structural,
  narrativeFileNode: structural,
  organization: structural,
  owningOrganization: structural,
  parent: structural,
  partner: structural,
  partnership: structural,
  photo: structural,
  photoNode: structural,
  pinned: structural,
  pnp: structural,
  pnpData: structural,
  pnpExtractionResult: structural,
  pnpNode: structural,
  pointOfContact: structural,
  post: structural,
  primaryLocation: structural,
  primaryOrganization: structural,
  problem: structural,
  produces: structural,
  product: structural,
  progress: structural,
  record: structural,
  report: structural,
  reportFile: structural,
  reportFileNode: structural,
  rootDirectory: structural,
  scriptureReferences: structural,
  scriptureReferencesOverride: structural,
  steps: structural,
  summary: structural,
  tool: structural,
  unavailability: structural,
  universalTemplateFile: structural,
  universalTemplateFileNode: structural,
  user: structural,
  uses: structural,
  varianceExplanation: structural,
  who: structural,
  workflowEvent: structural,
  zone: structural,

  // ── Present locally but NOT in production (added 2026-07-31) ──────────────
  // The first dry run surfaced 30 names the production catalog does not contain.
  // Two causes, and both mean a production snapshot was never a sufficient basis
  // for this file:
  //   * features that have not shipped yet (`marketingRegionOverride`)
  //   * things production has none of, but dev exercises — notification
  //     `recipient` edges being the case we already measured at zero in prod
  //   * dead schema from removed features, still in a dev graph
  // Each was probed for what it actually points at rather than guessed from its
  // name — `fieldZoneId` is a LINK to a FieldZone despite reading like an id, and
  // `strategicAlliances` points at BOTH a Property and a Partner.
  producer: structural,
  recipient: structural,
  appliedBy: structural,
  container: structural,
  fieldZone: structural,
  fieldZoneId: structural,
  alliance: structural,
  allianceMembers: structural,
  marketingRegionOverride: structural,
  languageOfWiderCommunication: structural,
  languageOfReporting: structural,
  languagesOfConsulting: structural,
  isLanguageOfWiderCommunication: safe('boolean'),
  isLanguageOfReporting: safe('boolean'),
  isWiderComm: safe('boolean, legacy spelling of the above'),
  applied: safe('changeset boolean'),
  editable: safe('changeset boolean'),
  appliedById: safe('holds an id'),
  appliedDate: safe('date'),
  joinedAt: safe('date'),
  gtlId: safe('external reference, dead in the codebase'),
  completedMilestone: safe('number'),
  adjustedAmount: safe('budget figure — consistent with the `amount` decision'),
  strategicAlliances: scrub(
    'prose',
    'dead in the codebase and absent from production, and it points at BOTH a Property and a Partner. Unknown content gets scrubbed rather than passed through: over-scrubbing a field nobody reads costs nothing, under-scrubbing leaks.',
  ),

  // ── Resolved 2026-07-31 (Rob): leave all of these ─────────────────────────
  // These were raised as blocking questions and all eleven were decided the same
  // day. Kept as their own group, with the reasoning, so a future reviewer sees a
  // decision rather than an oversight.
  gender: safe(
    'DECIDED (Rob 2026-07-31): leave. Personal but a small enum — swapping one value for another protects little. I had recommended scrubbing; overruled, and the reasoning holds either way.',
  ),
  accountNumber: safe(
    'DECIDED (Rob 2026-07-31): leave. A SecuredInt internal accounting code, NOT a bank account despite the name, and it carries a uniqueness test the migration measures.',
  ),
  amount: safe(
    'DECIDED (Rob 2026-07-31): leave. Organizational budget figures, not donations, so outside the donor-amount rule.',
  ),
  initialAmount: safe('DECIDED (Rob 2026-07-31): leave. See `amount`.'),
  preApprovedAmount: safe('DECIDED (Rob 2026-07-31): leave. See `amount`.'),
  code: safe(
    'DECIDED (Rob 2026-07-31): leave. ISO 639-3 and registry codes are published standards, and scrambling them would destroy the duplicate-code evidence behind the migration-0030 index drops. Applies to the four sibling code fields below.',
  ),
  provisionalCode: safe('DECIDED (Rob 2026-07-31): leave. See `code`.'),
  registryOfDialectsCode: safe('DECIDED (Rob 2026-07-31): leave. See `code`.'),
  registryOfLanguageVarietiesCode: safe(
    'DECIDED (Rob 2026-07-31): leave. See `code`.',
  ),
  signLanguageCode: safe('DECIDED (Rob 2026-07-31): leave. See `code`.'),
};

/**
 * Direct properties on nodes and relationships (81 keys in production).
 *
 * ⚠ `db.propertyKeys()` returns every key that has EVER existed, not what is in
 * use. `commentDescription`, `commentPrayerNeeds` and `commentProposalComments`
 * are listed there and exist on **0 of 5,264 projects** — the 2021 migration
 * removed them. Verified, so they are `delete` rather than `scrub`. A key with no
 * live values must not sit on this list demanding review forever.
 */
export const properties: Readonly<Record<string, Action>> = {
  // ── Dead 2021 migration artifacts ─────────────────────────────────────────
  '87SixId': {
    kind: 'delete',
    why: 'join key for the Aug-2021 import from 87Six, the system Cord v3 replaced. On 2,210 of 5,264 projects (only those existing at import), nothing has written it since, nothing reads it, and there is no live system on the other end.',
  },
  v2User: {
    kind: 'delete',
    why: 'old-system actor id on field-history records. 4,546 values, 106 distinct, fixed 24 chars, none contain "@" — opaque, not a name. Nothing reads it and the migration does not carry it.',
  },
  finalReportMigration: {
    kind: 'delete',
    why: 'rollback marker from the same 2021 effort. 7,738 reports, exactly ONE distinct value. Not data.',
  },
  postMigration: {
    kind: 'delete',
    why: 'rollback marker set by 87SixComments.migration.ts, "in case of reversion". Never reverted.',
  },
  commentDescription: {
    kind: 'delete',
    why: 'imported from 87Six, converted to posts and removed in 2021. Verified 0 of 5,264 projects.',
  },
  commentPrayerNeeds: {
    kind: 'delete',
    why: 'as commentDescription. Would be genuinely sensitive if any survived — none do.',
  },
  commentProposalComments: {
    kind: 'delete',
    why: 'as commentDescription.',
  },
  migrated: { kind: 'delete', why: 'migration marker' },
  migration: { kind: 'delete', why: 'migration marker' },

  // ── The polymorphic one — resolved through `links` above ───────────────────
  value: safe('sensitivity is decided by the link pointing at it, see `links`'),
  // Snake case because these are Neo4j's own property names, not ours — the keys
  // in this object must match the graph exactly or the guard cannot find them.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  deleted_value: safe('as `value`, on a soft-deleted field record'),
  sortValue: safe('a derived sort key — regenerated from the scrubbed value'),

  // ── Free text held directly on a node ─────────────────────────────────────
  notes: scrub('richText', 'workflow event notes — 0 in prod today, but wired'),
  caption: scrub('prose', 'media caption'),
  response: scrub(
    'richText',
    'prompt answers — 23,815 in prod, the largest set',
  ),

  // ── Credentials ───────────────────────────────────────────────────────────
  secret: scrub('credential', 'webhook signing secret — live in a dump'),
  token: scrub(
    'credential',
    'session and password-reset tokens — live in a dump',
  ),

  // ── Identifiers, dates, structure ─────────────────────────────────────────
  id: safe('opaque nanoid'),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  deleted_id: safe('opaque'),
  originalParentId: safe('opaque'),
  property: safe('internal field name'),
  key: safe('slug'),
  createdAt: safe('date'),
  createdOn: safe('date'),
  modifiedAt: safe('date'),
  deletedAt: safe('date'),
  lastUsedAt: safe('date'),
  primarySchemaUpdateAt: safe('date'),
  v2Timestamp: safe('date'),
  read: safe('read-state date on a notification recipient link'),
  active: safe('boolean'),
  edit: safe('boolean'),
  valid: safe('boolean'),
  mimeType: safe('media type'),
  departmentId: safe('finance code'),

  // ── Numbers, enums, machine output ────────────────────────────────────────
  actual: safe('number'),
  planned: safe('number'),
  progressActual: safe('number'),
  progressPlanned: safe('number'),
  variance: safe('number'),
  totalVerses: safe('count'),
  duration: safe('number'),
  height: safe('pixels'),
  width: safe('pixels'),
  year: safe('year'),
  quarter: safe('number'),
  // Also link names — separate namespace. As direct properties these are the
  // verse bounds on a ScriptureRange.
  start: safe('scripture range start verse'),
  end: safe('scripture range end verse'),
  period: safe('enum'),
  pnpIndex: safe('spreadsheet row index'),
  book: safe('Bible book name — a published canon, not project data'),
  medium: safe('enum'),
  methodology: safe('enum'),
  category: safe('enum'),
  type: safe('enum'),
  status: safe('enum'),
  step: safe('enum'),
  to: safe('enum — a workflow event target step'),
  transition: safe('enum'),
  variant: safe('enum'),
  role: safe('enum'),
  roles: safe('enum list'),
  powers: safe('enum list'),
  projectTypes: safe('enum list'),
  programs: safe('enum list'),
  source: safe('enum'),
  severity: safe('enum'),
  countError: safe('count'),
  countNotice: safe('count'),
  countWarning: safe('count'),
  hasError: safe('boolean'),
  hasNotice: safe('boolean'),
  hasWarning: safe('boolean'),
  hadNaN: safe('boolean'),
  blocks: safe('JSON ranges of department-id numbers, no free text'),
  subscription: safe('a GraphQL document, app-authored'),
  url: safe('webhook target URL, app config not user content'),
  creator: safe('holds a user id'),
  name: scrub(
    'entityName',
    'direct on SystemAgent and on file nodes — a file name can carry a person’s name',
  ),

  // ── Present locally but NOT in production (added 2026-07-31) ──────────────
  // Probed on the local graph rather than inferred from the names.
  readAt: safe('date, carried on the notification recipient edge'),
  photo: safe('holds a file id, on User'),
  public: safe('boolean, on File'),
  message: scrub(
    'prose',
    'SystemNotification text. App-authored, but these templates interpolate the thing they are about, so a name can ride along. Nothing depends on the wording.',
  ),
  createdBy: scrub(
    'prose',
    'on the department-id nodes, 10 values, no references anywhere in the codebase — so its content is genuinely unknown. Scrubbed on the when-in-doubt rule.',
  ),
  comment: scrub(
    'prose',
    'registry ghost — 0 live values locally and absent from production. Classified as scrub rather than safe so that if it ever gains values, free text under this name does not pass through unnoticed.',
  ),

  // ── Resolved 2026-07-31 (Rob): leave both ─────────────────────────────────
  // ⚠ RESIDUAL RISK, recorded rather than re-argued. Both hold spreadsheet
  // extraction output. It is machine-generated, which is why leaving it is
  // reasonable — but templated messages interpolate the cells that triggered
  // them, so if any planning spreadsheet carries narrative text, a fragment could
  // survive here. Nobody has read the real values.
  //
  // Mitigation that needs no one to read anything: the verify pass counts long
  // free-text runs inside these two blobs and reports the COUNT per field. Zero
  // closes the question outright. Non-zero is a signal to revisit, without ever
  // surfacing a value. Cheaper than an inspection and repeats on every refresh.
  context: safe(
    'DECIDED (Rob 2026-07-31): leave. Machine-generated extraction render context. Watched by the verify pass free-text probe.',
  ),
  problems: safe(
    'DECIDED (Rob 2026-07-31): leave. Machine-generated extraction messages. Watched by the verify pass free-text probe.',
  ),
};

/**
 * Emptied in a dedicated pass that runs BEFORE the main scrub, so an interrupted
 * run cannot leave working credentials behind. Passwords are set to one known dev
 * value rather than emptied — it is the only way to log in to the copy.
 */
export const credentialLinks = ['password', 'token'] as const;
export const credentialProperties = ['secret', 'token'] as const;

export interface UnclassifiedReport {
  readonly links: readonly string[];
  readonly properties: readonly string[];
  readonly unresolvedReviews: readonly string[];
}

/**
 * The guard. Compare the live graph against this file; anything unlisted, or any
 * `review` still unanswered, stops the scrub.
 *
 * Deliberately reports EVERYTHING wrong at once rather than failing on the first
 * problem — whoever fixes this wants the whole list, not one entry per run.
 */
export const findUnclassified = (
  liveLinkTypes: readonly string[],
  livePropertyKeys: readonly string[],
): UnclassifiedReport => ({
  links: liveLinkTypes.filter((type) => !(type in links)),
  properties: livePropertyKeys.filter((key) => !(key in properties)),
  unresolvedReviews: [...Object.entries(links), ...Object.entries(properties)]
    .filter(([, action]) => action.kind === 'review')
    .map(([name]) => name),
});
