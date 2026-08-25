import { type CorpusEntry } from './types';

/**
 * The hand-enumerated read-only corpus, covering the 12 queryable domains
 * that are landed on Postgres AND loaded by the cutover ETL:
 *
 *   users · tools · fundingAccounts · locations · fieldZones · fieldRegions
 *   organizations · partners · projects · projectMembers · partnerships
 *   notifications
 *
 * - projectMembers have no top-level query; they are read via `project.team`
 *   (see the project by-id document).
 * - Education + Unavailability are read via `user.education` /
 *   `user.unavailabilities` sub-selections on the user by-id document.
 * - EthnologueLanguage is only reachable through Language (not landed) and is
 *   EXCLUDED (see README).
 *
 * Lists select `total` + `hasMore` + item IDS only — ordering, filtering, and
 * row-visibility parity. Full secured-field coverage lives on the by-id
 * documents (expanded over K=5 deterministically sampled ids per domain).
 *
 * Field selections cover MIGRATED-BACKED fields only. Every exclusion is
 * commented with why, so re-adding at each domain land is a grep away.
 *
 * ⚠ That last sentence was true and nobody acted on it. Between 2026-07-30 and
 * 2026-08-25 every domain named in an exclusion landed — Language, Engagement,
 * Pin, Location, Partnership, Budget — and the exclusions stayed, so the gate
 * kept reporting a clean comparison over a corpus that had quietly stopped
 * asking about the fields most likely to differ. An exclusion here is a debt
 * with no due date attached, which is why it went unpaid.
 *
 * So: when a domain lands, grep this file for its name and re-add. And when
 * you change anything here, run
 *
 *     node src/core/shadow-diff/validate-corpus.ts
 *
 * BEFORE spending a capture run. An invalid selection fails on BOTH engines,
 * so the two captures record matching errors and the diff reports them as
 * identical — a broken corpus entry looks exactly like a passing one. That
 * validator caught three mistakes in this file's own widening pass.
 */

// ─── users ───────────────────────────────────────────────────────────────────
// `pinned` IS now covered — it was excluded as an unmigrated domain and the
// Pin domain has since landed and loads (1,201 rows).
//
// `isIntern` is NOT here, and cannot be: it is not exposed in GraphQL at all.
// It is an internal DTO field feeding a Marketing policy condition, so the old
// note calling it an exclusion was misleading — there is no query that could
// have selected it. It is still worth knowing that Postgres now computes it
// from the engagement join rather than stubbing it, because a wrong value
// changes what Marketing users are allowed to see; that shows up here only
// indirectly, through Marketing-persona reads.
//
// `knownLanguages` is also not selected: the source graph has no
// `knownLanguage` relationship at all (verified against prod), so both engines
// return an empty list and the comparison would assert nothing.
// photo IS included (File-domain boundary resolves via the Neo4j file repo on
//   both engines); its null-shape difference is registered as known-delta U14.
const userFields = /* GraphQL */ `
  id
  createdAt
  fullName
  firstName
  avatarLetters
  email { value canRead canEdit }
  realFirstName { value canRead canEdit }
  realLastName { value canRead canEdit }
  displayFirstName { value canRead canEdit }
  displayLastName { value canRead canEdit }
  phone { value canRead canEdit }
  timezone { canRead canEdit value { name } }
  about { value canRead canEdit }
  status { value canRead canEdit }
  roles { value canRead canEdit }
  title { value canRead canEdit }
  photo { canRead canEdit value { id } }
  pinned
`;

const userById = /* GraphQL */ `
  query ShadowUserById($id: ID!) {
    user(id: $id) {
      ${userFields}
      education {
        canRead canCreate total hasMore
        items {
          id
          createdAt
          degree { value canRead canEdit }
          major { value canRead canEdit }
          institution { value canRead canEdit }
        }
      }
      unavailabilities {
        canRead canCreate total hasMore
        items {
          id
          createdAt
          description { value canRead canEdit }
          start { value canRead canEdit }
          end { value canRead canEdit }
        }
      }
      # locations now selects its items: listLocationsFromNode is a real query
      # on Postgres, not the EMPTY_PAGE stub the old note described.
      # organizations/partners still take perms only — userId-filtered
      # from-user reads are not validated on PG yet, and the can* fields are
      # policy-driven and so engine-agnostic either way.
      organizations { canRead canCreate }
      partners { canRead canCreate }
      locations {
        canRead canCreate total hasMore
        items { id name { value canRead canEdit } }
      }
    }
  }
`;

const usersList = /* GraphQL */ `
  query ShadowUsersList($input: UserListInput) {
    users(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── tools ───────────────────────────────────────────────────────────────────
const toolById = /* GraphQL */ `
  query ShadowToolById($id: ID!) {
    tool(id: $id) {
      id
      createdAt
      name {
        value
        canRead
        canEdit
      }
      description {
        value
        canRead
        canEdit
      }
      aiBased {
        value
        canRead
        canEdit
      }
      key {
        value
        canRead
        canEdit
      }
    }
  }
`;

const toolsList = /* GraphQL */ `
  query ShadowToolsList($input: ToolListInput) {
    tools(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── fundingAccounts ─────────────────────────────────────────────────────────
const fundingAccountById = /* GraphQL */ `
  query ShadowFundingAccountById($id: ID!) {
    fundingAccount(id: $id) {
      id
      createdAt
      name {
        value
        canRead
        canEdit
      }
      accountNumber {
        value
        canRead
        canEdit
      }
    }
  }
`;

const fundingAccountsList = /* GraphQL */ `
  query ShadowFundingAccountsList($input: FundingAccountListInput) {
    fundingAccounts(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── locations ───────────────────────────────────────────────────────────────
// Excluded: mapImage (File-domain boundary; not covered by the proven test
//   fragments — revisit when the File domain lands).
const locationById = /* GraphQL */ `
  query ShadowLocationById($id: ID!) {
    location(id: $id) {
      id
      createdAt
      name {
        value
        canRead
        canEdit
      }
      type {
        value
        canRead
        canEdit
      }
      isoAlpha3 {
        value
        canRead
        canEdit
      }
      fundingAccount {
        canRead
        canEdit
        value {
          id
        }
      }
      defaultFieldRegion {
        canRead
        canEdit
        value {
          id
        }
      }
      defaultMarketingRegion {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  }
`;

const locationsList = /* GraphQL */ `
  query ShadowLocationsList($input: LocationListInput) {
    locations(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── fieldZones ──────────────────────────────────────────────────────────────
const fieldZoneById = /* GraphQL */ `
  query ShadowFieldZoneById($id: ID!) {
    fieldZone(id: $id) {
      id
      createdAt
      name {
        value
        canRead
        canEdit
      }
      director {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  }
`;

const fieldZonesList = /* GraphQL */ `
  query ShadowFieldZonesList($input: FieldZoneListInput) {
    fieldZones(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── fieldRegions ────────────────────────────────────────────────────────────
const fieldRegionById = /* GraphQL */ `
  query ShadowFieldRegionById($id: ID!) {
    fieldRegion(id: $id) {
      id
      createdAt
      name {
        value
        canRead
        canEdit
      }
      fieldZone {
        canRead
        canEdit
        value {
          id
        }
      }
      director {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  }
`;

const fieldRegionsList = /* GraphQL */ `
  query ShadowFieldRegionsList($input: FieldRegionListInput) {
    fieldRegions(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── organizations ───────────────────────────────────────────────────────────
// The locations sub-list IS now covered — `listLocationsFromNode` is a real
// query on Postgres, not the EMPTY_PAGE stub the old note described.
const organizationById = /* GraphQL */ `
  query ShadowOrganizationById($id: ID!) {
    organization(id: $id) {
      id
      createdAt
      sensitivity
      name {
        value
        canRead
        canEdit
      }
      acronym {
        value
        canRead
        canEdit
      }
      address {
        value
        canRead
        canEdit
      }
      types {
        value
        canRead
        canEdit
      }
      reach {
        value
        canRead
        canEdit
      }
      locations(input: { count: 25 }) {
        canRead
        canCreate
        total
        hasMore
        items {
          id
          name {
            value
            canRead
            canEdit
          }
        }
      }
    }
  }
`;

const organizationsList = /* GraphQL */ `
  query ShadowOrganizationsList($input: OrganizationListInput) {
    organizations(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── partners ────────────────────────────────────────────────────────────────
// The three language links and `pinned` ARE now covered — Language and Pin
// have both landed, so the reasons those were excluded are gone.
// Still excluded: projects / languages / engagements / people sub-lists —
//   cross-domain lists. Projects has its own corpus entries, engagements is
//   covered from the engagement side, and `people` is filtered by organization
//   membership, which reads through a path this corpus covers elsewhere.
const partnerById = /* GraphQL */ `
  query ShadowPartnerById($id: ID!) {
    partner(id: $id) {
      id
      createdAt
      modifiedAt
      sensitivity
      organization {
        canRead
        canEdit
        value {
          id
        }
      }
      pointOfContact {
        canRead
        canEdit
        value {
          id
        }
      }
      types {
        value
        canRead
        canEdit
      }
      financialReportingTypes {
        value
        canRead
        canEdit
      }
      pmcEntityCode {
        value
        canRead
        canEdit
      }
      globalInnovationsClient {
        value
        canRead
        canEdit
      }
      active {
        value
        canRead
        canEdit
      }
      address {
        value
        canRead
        canEdit
      }
      startDate {
        value
        canRead
        canEdit
      }
      approvedPrograms {
        value
        canRead
        canEdit
      }
      departmentIdBlock {
        canRead
        canEdit
        value {
          id
          blocks
          programs
        }
      }
      fieldRegions {
        canRead
        canEdit
        value {
          id
        }
      }
      countries {
        canRead
        canEdit
        value {
          id
        }
      }
      languageOfWiderCommunication {
        canRead
        canEdit
        value {
          id
        }
      }
      languageOfReporting {
        canRead
        canEdit
        value {
          id
        }
      }
      languagesOfConsulting {
        canRead
        canEdit
        value {
          id
        }
      }
      pinned
    }
  }
`;

const partnersList = /* GraphQL */ `
  query ShadowPartnersList($input: PartnerListInput) {
    partners(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── projects (+ projectMembers via team) ────────────────────────────────────
// `pinned`, `engagements` and `budget` ARE now covered — Pin, Engagement and
// Budget have all landed. `engagements.total` also covers what the old note
// called `engagementTotal`, which is an internal field with no GraphQL
// counterpart; it is no longer stubbed at 0 either way.
//
// `primaryPartnership` IS now covered. It was the one exclusion here that was
// a real gap rather than a stale note — Postgres returned a hardcoded null
// while Neo4j hydrated it and could filter on it — and the repository is now
// wired (branch `pg-project-primary-partnership`), so the field is selected
// rather than skipped.
// Still excluded: changeRequests — changesets are not carried forward.
// rootDirectory value is id-only (File-domain boundary; column parity only).
const projectById = /* GraphQL */ `
  query ShadowProjectById($id: ID!) {
    project(id: $id) {
      id
      createdAt
      modifiedAt
      type
      sensitivity
      status
      name {
        value
        canRead
        canEdit
      }
      departmentId {
        value
        canRead
        canEdit
      }
      step {
        value
        canRead
        canEdit
      }
      stepChangedAt {
        value
        canRead
        canEdit
      }
      mouStart {
        value
        canRead
        canEdit
      }
      mouEnd {
        value
        canRead
        canEdit
      }
      initialMouEnd {
        value
        canRead
        canEdit
      }
      estimatedSubmission {
        value
        canRead
        canEdit
      }
      tags {
        value
        canRead
        canEdit
      }
      financialReportReceivedAt {
        value
        canRead
        canEdit
      }
      financialReportPeriod {
        value
        canRead
        canEdit
      }
      primaryLocation {
        canRead
        canEdit
        value {
          id
        }
      }
      marketingLocation {
        canRead
        canEdit
        value {
          id
        }
      }
      marketingRegionOverride {
        canRead
        canEdit
        value {
          id
        }
      }
      fieldRegion {
        canRead
        canEdit
        value {
          id
        }
      }
      owningOrganization {
        canRead
        canEdit
        value {
          id
        }
      }
      rootDirectory {
        canRead
        canEdit
        value {
          id
        }
      }
      presetInventory {
        value
        canRead
        canEdit
      }
      partnerships {
        canRead
        canCreate
      }
      team {
        canRead
        canCreate
        total
        hasMore
        items {
          id
          createdAt
          modifiedAt
          sensitivity
          active
          inactiveAt {
            value
            canRead
            canEdit
          }
          roles {
            value
            canRead
            canEdit
          }
          user {
            canRead
            canEdit
            value {
              id
            }
          }
        }
      }
      pinned
      budget {
        canRead
        canEdit
        value {
          id
        }
      }
      engagements(input: { count: 25 }) {
        canRead
        canCreate
        total
        hasMore
        items {
          id
          __typename
        }
      }
      primaryPartnership {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  }
`;

const projectsList = /* GraphQL */ `
  query ShadowProjectsList($input: ProjectListInput) {
    projects(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── partnerships ────────────────────────────────────────────────────────────
// mou/agreement values are id-only (File-domain boundary; column parity only).
const partnershipById = /* GraphQL */ `
  query ShadowPartnershipById($id: ID!) {
    partnership(id: $id) {
      id
      createdAt
      sensitivity
      agreementStatus {
        value
        canRead
        canEdit
      }
      mouStatus {
        value
        canRead
        canEdit
      }
      mouStart {
        value
        canRead
        canEdit
      }
      mouEnd {
        value
        canRead
        canEdit
      }
      mouStartOverride {
        value
        canRead
        canEdit
      }
      mouEndOverride {
        value
        canRead
        canEdit
      }
      types {
        value
        canRead
        canEdit
      }
      primary {
        value
        canRead
        canEdit
      }
      financialReportingType {
        value
        canRead
        canEdit
      }
      partner {
        canRead
        canEdit
        value {
          id
        }
      }
      mou {
        canRead
        canEdit
        value {
          id
        }
      }
      agreement {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  }
`;

const partnershipsList = /* GraphQL */ `
  query ShadowPartnershipsList($input: PartnershipListInput) {
    partnerships(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

// ─── notifications ───────────────────────────────────────────────────────────
// Requester-scoped: per-persona results are expected and must match across
// engines for the same persona. No top-level by-id query exists.
// Only the SystemNotification concrete selection is included; comment-mention
// notifications hydrate through the Comments domain (not landed).
const notificationsList = /* GraphQL */ `
  query ShadowNotificationsList($input: NotificationListInput) {
    notifications(input: $input) {
      total
      totalUnread
      hasMore
      items {
        __typename
        id
        createdAt
        unread
        readAt
        ... on SystemNotification {
          message
        }
      }
    }
  }
`;

// ─── the corpus ──────────────────────────────────────────────────────────────

// ─── languages ───────────────────────────────────────────────────────────────
// Added 2026-07-30. Excluded and why:
//   tools           — NOW COVERED. It was excluded because ToolUsage had no
//                     table; `tool_usages` now exists and loads (1,033 rows),
//                     and the field resolves through a tool-usage loader that
//                     never touches the audit trail.
//   history         — resource_mutations exists but the ETL does not load it, so
//                     Postgres would be empty against a populated Neo4j.
//   firstScripture  — union over engagement/product derivation; covered
//                     indirectly by hasExternalFirstScripture (a stored bool).
//   usesAIAssistance — derived, and carries a known Neo4j 42N07 shadowing fault
//                     on the filter+sort combination (transition-only, won't fix).
// pinned IS included — it is how this corpus covers the Pin domain at all.
const languageFields = /* GraphQL */ `
  id
  createdAt
  avatarLetters
  sensitivity
  pinned
  name { value canRead canEdit }
  displayName { value canRead canEdit }
  displayNamePronunciation { value canRead canEdit }
  isDialect { value canRead canEdit }
  isSignLanguage { value canRead canEdit }
  signLanguageCode { value canRead canEdit }
  population { value canRead canEdit }
  populationOverride { value canRead canEdit }
  registryOfLanguageVarietiesCode { value canRead canEdit }
  leastOfThese { value canRead canEdit }
  leastOfTheseReason { value canRead canEdit }
  sponsorStartDate { value canRead canEdit }
  sponsorEstimatedEndDate { value canRead canEdit }
  isAvailableForReporting { value canRead canEdit }
  presetInventory { value canRead canEdit }
  hasExternalFirstScripture { value canRead canEdit }
  tags { value canRead canEdit }
  ethnologue {
    sensitivity
    code { value canRead canEdit }
    provisionalCode { value canRead canEdit }
    name { value canRead canEdit }
    population { value canRead canEdit }
  }
  tools {
    canRead canCreate total hasMore
    items { id tool { id } }
  }
`;

const languagesList = /* GraphQL */ `
  query ShadowLanguages($input: LanguageListInput) {
    languages(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

const languageById = /* GraphQL */ `
  query ShadowLanguageById($id: ID!) {
    language(id: $id) {
      ${languageFields}
      posts { total hasMore canRead canCreate items { id type shareability } }
      commentThreads { total hasMore canRead canCreate items { id } }
    }
  }
`;

// ─── engagements ─────────────────────────────────────────────────────────────
// Read through `engagement(id)` (the interface) rather than
// `languageEngagement(id)`, so one document covers BOTH subtypes and the
// sampled id set does not have to be split by type.
// partnershipsProducingMediums IS now covered — it had no table when this was
// written and now loads (1,906 rows).
// Still excluded: pnp / pnpExtractionResult — `pnp_extraction_results` does
//   load now, but the field hangs off the PnP FILE, which still answers from
//   the Neo4j file repository on both engines, so it would compare one source
//   with itself.
// Still excluded: changeset + changesetDiff (changesets are not carried
//   forward), history (`resource_mutations` is not loaded by the ETL),
//   usingAIAssistedTranslation (tool-derived).
const engagementsList = /* GraphQL */ `
  query ShadowEngagements($input: EngagementListInput) {
    engagements(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

const engagementById = /* GraphQL */ `
  query ShadowEngagementById($id: ID!) {
    engagement(id: $id) {
      __typename
      id
      createdAt
      modifiedAt
      sensitivity
      status {
        value
        canRead
        canEdit
      }
      statusModifiedAt {
        value
        canRead
        canEdit
      }
      lastSuspendedAt {
        value
        canRead
        canEdit
      }
      lastReactivatedAt {
        value
        canRead
        canEdit
      }
      completeDate {
        value
        canRead
        canEdit
      }
      disbursementCompleteDate {
        value
        canRead
        canEdit
      }
      startDate {
        value
        canRead
        canEdit
      }
      endDate {
        value
        canRead
        canEdit
      }
      startDateOverride {
        value
        canRead
        canEdit
      }
      endDateOverride {
        value
        canRead
        canEdit
      }
      initialEndDate {
        value
        canRead
        canEdit
      }
      description {
        value
        canRead
        canEdit
      }
      ceremony {
        canRead
        canEdit
        value {
          id
        }
      }
      ... on LanguageEngagement {
        historicGoal {
          value
          canRead
          canEdit
        }
        lukePartnership {
          value
          canRead
          canEdit
        }
        openToInvestorVisit {
          value
          canRead
          canEdit
        }
        firstScripture {
          value
          canRead
          canEdit
        }
        paratextRegistryId {
          value
          canRead
          canEdit
        }
        milestonePlanned {
          value
          canRead
          canEdit
        }
        milestoneReached {
          value
          canRead
          canEdit
        }
        sentPrintingDate {
          value
          canRead
          canEdit
        }
        rev79CommunityId {
          value
          canRead
          canEdit
        }
        language {
          canRead
          canEdit
          value {
            id
          }
        }
        products {
          total
          hasMore
          canRead
          canCreate
          items {
            id
          }
        }
        progressReports {
          total
          hasMore
          items {
            id
          }
        }
      }
      ... on InternshipEngagement {
        methodologies {
          value
          canRead
          canEdit
        }
        position {
          value
          canRead
          canEdit
        }
        intern {
          canRead
          canEdit
          value {
            id
          }
        }
        mentor {
          canRead
          canEdit
          value {
            id
          }
        }
        countryOfOrigin {
          canRead
          canEdit
          value {
            id
          }
        }
      }
      ... on LanguageEngagement {
        partnershipsProducingMediums {
          canRead
          canCreate
          total
          hasMore
          items {
            medium
            partnership {
              id
            }
          }
        }
      }
    }
  }
`;

// ─── products ────────────────────────────────────────────────────────────────
// Product is an interface; the three concrete types carry the fields that the
// single-table-inheritance CHECKs are built around, so each gets a fragment.
// Excluded: tools, history, project/engagement back-refs (covered from the
// engagement side), progressReport* (covered via the ProgressReport document).
const productsList = /* GraphQL */ `
  query ShadowProducts($input: ProductListInput) {
    products(input: $input) {
      total
      hasMore
      items {
        id
      }
    }
  }
`;

const productById = /* GraphQL */ `
  query ShadowProductById($id: ID!) {
    product(id: $id) {
      __typename
      id
      createdAt
      sensitivity
      approach
      category
      availableSteps
      mediums {
        value
        canRead
        canEdit
      }
      purposes {
        value
        canRead
        canEdit
      }
      methodology {
        value
        canRead
        canEdit
      }
      steps {
        value
        canRead
        canEdit
      }
      describeCompletion {
        value
        canRead
        canEdit
      }
      placeholderDescription {
        value
        canRead
        canEdit
      }
      progressStepMeasurement {
        value
        canRead
        canEdit
      }
      progressTarget {
        value
        canRead
        canEdit
      }
      scriptureReferences {
        canRead
        canEdit
        value {
          start {
            book
            chapter
            verse
          }
          end {
            book
            chapter
            verse
          }
        }
      }
      ... on DirectScriptureProduct {
        unspecifiedScripture {
          canRead
          canEdit
          value {
            book
            totalVerses
          }
        }
        totalVerses
        totalVerseEquivalents
      }
      ... on DerivativeScriptureProduct {
        composite {
          value
          canRead
          canEdit
        }
        totalVerses
        totalVerseEquivalents
        scriptureReferencesOverride {
          canRead
          canEdit
          value {
            start {
              book
              chapter
              verse
            }
            end {
              book
              chapter
              verse
            }
          }
        }
        produces {
          canRead
          canEdit
          value {
            id
            __typename
          }
        }
      }
      ... on OtherProduct {
        title {
          value
          canRead
          canEdit
        }
        description {
          value
          canRead
          canEdit
        }
      }
    }
  }
`;

// ─── periodic + progress reports ─────────────────────────────────────────────
// varianceExplanation and workflowEvents ARE now covered. They were excluded
// because no Postgres table existed for either, which the note called a real
// gap; both tables now exist and load (5,725 and 47,498 rows). This is exactly
// the case the header warns about — an exclusion that outlived its reason.
//
// Still excluded: reportFile / narrativeFile / media / featuredMedia /
// pnpExtractionResult — file_nodes DOES load now, but a DefinedFile answers
// through the Neo4j file repository on both engines, so these compare the same
// source twice and prove nothing about the migration. Revisit when the file
// domain reads from Postgres.
// Still excluded: tools, history — `resource_mutations` exists as a table but
// the ETL does not load it (verified against the 2026-08-25 load), so Postgres
// would answer empty against a populated Neo4j.
const periodicReportsList = /* GraphQL */ `
  query ShadowPeriodicReports($input: PeriodicReportListInput) {
    periodicReports(input: $input) {
      total
      hasMore
      items {
        id
        __typename
        type
        start
        end
        due
      }
    }
  }
`;

const periodicReportById = /* GraphQL */ `
  query ShadowPeriodicReportById($id: ID!) {
    periodicReport(id: $id) {
      __typename
      id
      createdAt
      type
      start
      end
      due
      sensitivity
      receivedDate {
        value
        canRead
        canEdit
      }
      narrativeReceivedDate {
        value
        canRead
        canEdit
      }
      skippedReason {
        value
        canRead
        canEdit
      }
      parent {
        id
      }
      ... on ProgressReport {
        status {
          value
          canRead
          canEdit
          transitions {
            id
            label
            to
            type
          }
        }
        cumulativeSummary {
          planned
          actual
          variance
          scheduleStatus
        }
        fiscalYearSummary {
          planned
          actual
          variance
          scheduleStatus
        }
        periodSummary {
          planned
          actual
          variance
          scheduleStatus
        }
        teamNews {
          total
          hasMore
          canRead
          canCreate
          items {
            id
            prompt {
              value {
                id
              }
            }
          }
        }
        highlights {
          total
          hasMore
          canRead
          canCreate
          items {
            id
          }
        }
        communityStories {
          total
          hasMore
          canRead
          canCreate
          items {
            id
          }
        }
        progress {
          variant {
            key
          }
          steps {
            step
            completed {
              value
              canRead
              canEdit
            }
          }
        }
        varianceExplanation {
          reasons {
            value
            canRead
            canEdit
          }
          scheduleStatus
        }
        workflowEvents {
          id
          at
          status
          transition {
            id
            label
            to
            type
          }
          who {
            value {
              id
            }
            canRead
          }
        }
      }
    }
  }
`;

const progressReportsList = /* GraphQL */ `
  query ShadowProgressReports($input: ProgressReportListInput) {
    progressReports(input: $input) {
      total
      hasMore
      canRead
      canCreate
      items {
        id
        start
        end
        status {
          value
        }
      }
    }
  }
`;

// ─── comments + posts (the leaves) ───────────────────────────────────────────
// `commentThreads(resource:)` needs a parent id, so threads are covered by-id
// instead; the comments list hangs off the thread document.
const commentThreadById = /* GraphQL */ `
  query ShadowCommentThreadById($id: ID!) {
    commentThread(id: $id) {
      id
      createdAt
      creator {
        id
      }
      parent {
        id
      }
      firstComment {
        id
        createdAt
      }
      latestComment {
        id
        createdAt
      }
      comments {
        total
        hasMore
        canRead
        canCreate
        items {
          id
          createdAt
          modifiedAt
          creator {
            id
          }
          body {
            value
            canRead
            canEdit
          }
        }
      }
    }
  }
`;

const postById = /* GraphQL */ `
  query ShadowPostById($id: ID!) {
    post(id: $id) {
      id
      createdAt
      modifiedAt
      type
      shareability
      body {
        value
        canRead
        canEdit
      }
      creator {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  }
`;

export const corpus: readonly CorpusEntry[] = [
  // users — default sort is `id`
  { key: 'users.list.default', document: usersList },
  {
    key: 'users.list.sort-displayLastName-asc',
    document: usersList,
    variables: { input: { sort: 'displayLastName' } },
  },
  {
    key: 'users.list.sort-displayLastName-desc',
    document: usersList,
    variables: { input: { sort: 'displayLastName', order: 'DESC' } },
  },
  {
    key: 'users.list.sort-createdAt-asc',
    document: usersList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'users.list.filter-status-active',
    document: usersList,
    variables: { input: { filter: { status: 'Active' } } },
  },
  { key: 'user.byId', document: userById, idsFrom: 'users' },

  // tools — default sort is `name`
  { key: 'tools.list.default', document: toolsList },
  {
    key: 'tools.list.sort-name-desc',
    document: toolsList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'tools.list.sort-createdAt-asc',
    document: toolsList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'tools.list.filter-aiBased',
    document: toolsList,
    variables: { input: { filter: { aiBased: true } } },
  },
  { key: 'tool.byId', document: toolById, idsFrom: 'tools' },

  // fundingAccounts — default sort is `name`; the input has no filter field
  { key: 'fundingAccounts.list.default', document: fundingAccountsList },
  {
    key: 'fundingAccounts.list.sort-name-desc',
    document: fundingAccountsList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'fundingAccounts.list.sort-createdAt-asc',
    document: fundingAccountsList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'fundingAccount.byId',
    document: fundingAccountById,
    idsFrom: 'fundingAccounts',
  },

  // locations — default sort is `name`
  { key: 'locations.list.default', document: locationsList },
  {
    key: 'locations.list.sort-name-desc',
    document: locationsList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'locations.list.sort-createdAt-asc',
    document: locationsList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'locations.list.filter-type-country',
    document: locationsList,
    variables: { input: { filter: { type: ['Country'] } } },
  },
  { key: 'location.byId', document: locationById, idsFrom: 'locations' },

  // fieldZones — default sort is `name`; only nested (director) filters exist
  { key: 'fieldZones.list.default', document: fieldZonesList },
  {
    key: 'fieldZones.list.sort-name-desc',
    document: fieldZonesList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'fieldZones.list.sort-createdAt-asc',
    document: fieldZonesList,
    variables: { input: { sort: 'createdAt' } },
  },
  { key: 'fieldZone.byId', document: fieldZoneById, idsFrom: 'fieldZones' },

  // fieldRegions — default sort is `name`
  { key: 'fieldRegions.list.default', document: fieldRegionsList },
  {
    key: 'fieldRegions.list.sort-name-desc',
    document: fieldRegionsList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'fieldRegions.list.sort-createdAt-asc',
    document: fieldRegionsList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'fieldRegion.byId',
    document: fieldRegionById,
    idsFrom: 'fieldRegions',
  },

  // organizations — default sort is `name`; the filter arg is internal (not
  // exposed in the schema — `@FilterField(..., { internal: true })`), so no
  // filter variant
  { key: 'organizations.list.default', document: organizationsList },
  {
    key: 'organizations.list.sort-name-desc',
    document: organizationsList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'organizations.list.sort-createdAt-asc',
    document: organizationsList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'organization.byId',
    document: organizationById,
    idsFrom: 'organizations',
  },

  // partners — default sort is `createdAt`; Partner has no own name column
  // (org-name sort is a cross-domain path — covered indirectly by orgs)
  { key: 'partners.list.default', document: partnersList },
  {
    key: 'partners.list.sort-createdAt-desc',
    document: partnersList,
    variables: { input: { sort: 'createdAt', order: 'DESC' } },
  },
  {
    key: 'partners.list.filter-globalInnovationsClient',
    document: partnersList,
    variables: { input: { filter: { globalInnovationsClient: true } } },
  },
  { key: 'partner.byId', document: partnerById, idsFrom: 'partners' },

  // projects — default sort is `name`
  { key: 'projects.list.default', document: projectsList },
  {
    key: 'projects.list.sort-name-desc',
    document: projectsList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'projects.list.sort-createdAt-asc',
    document: projectsList,
    variables: { input: { sort: 'createdAt' } },
  },
  {
    key: 'projects.list.filter-type-momentum',
    document: projectsList,
    variables: { input: { filter: { type: ['MomentumTranslation'] } } },
  },
  { key: 'project.byId', document: projectById, idsFrom: 'projects' },

  // partnerships — default sort is `createdAt`; the filter arg is internal
  // (not exposed in the schema), so no filter variant
  { key: 'partnerships.list.default', document: partnershipsList },
  {
    key: 'partnerships.list.sort-createdAt-desc',
    document: partnershipsList,
    variables: { input: { sort: 'createdAt', order: 'DESC' } },
  },
  {
    key: 'partnership.byId',
    document: partnershipById,
    idsFrom: 'partnerships',
  },

  // notifications — requester-scoped; unsorted pagination input
  { key: 'notifications.list.default', document: notificationsList },
  {
    key: 'notifications.list.filter-unread',
    document: notificationsList,
    variables: { input: { filter: { unread: true } } },
  },
  // ─── languages (added 2026-07-30) ──────────────────────────────────────────
  { key: 'languages.list.default', document: languagesList },
  {
    key: 'languages.list.sort-name-desc',
    document: languagesList,
    variables: { input: { sort: 'name', order: 'DESC' } },
  },
  {
    key: 'languages.list.sort-createdAt-asc',
    document: languagesList,
    variables: { input: { sort: 'createdAt', order: 'ASC' } },
  },
  {
    key: 'languages.list.filter-isDialect',
    document: languagesList,
    variables: { input: { filter: { isDialect: true } } },
  },
  {
    key: 'languages.list.filter-presetInventory',
    document: languagesList,
    variables: { input: { filter: { presetInventory: true } } },
  },
  { key: 'language.byId', document: languageById, idsFrom: 'languages' },

  // ─── engagements ──────────────────────────────────────────────────────────
  { key: 'engagements.list.default', document: engagementsList },
  {
    key: 'engagements.list.sort-createdAt-desc',
    document: engagementsList,
    variables: { input: { sort: 'createdAt', order: 'DESC' } },
  },
  {
    key: 'engagements.list.filter-status-active',
    document: engagementsList,
    variables: { input: { filter: { status: ['Active'] } } },
  },
  {
    key: 'engagements.list.filter-type-language',
    document: engagementsList,
    variables: { input: { filter: { type: 'language' } } },
  },
  { key: 'engagement.byId', document: engagementById, idsFrom: 'engagements' },

  // ─── products ─────────────────────────────────────────────────────────────
  { key: 'products.list.default', document: productsList },
  {
    key: 'products.list.sort-createdAt-desc',
    document: productsList,
    variables: { input: { sort: 'createdAt', order: 'DESC' } },
  },
  {
    key: 'products.list.filter-methodology',
    document: productsList,
    variables: { input: { filter: { methodology: 'OtherWritten' } } },
  },
  { key: 'product.byId', document: productById, idsFrom: 'products' },

  // ─── periodic + progress reports ──────────────────────────────────────────
  { key: 'periodicReports.list.default', document: periodicReportsList },
  {
    key: 'periodicReports.list.filter-type-progress',
    document: periodicReportsList,
    variables: { input: { type: 'Progress' } },
  },
  {
    key: 'periodicReports.list.sort-end-desc',
    document: periodicReportsList,
    variables: { input: { sort: 'end', order: 'DESC' } },
  },
  {
    key: 'periodicReport.byId',
    document: periodicReportById,
    idsFrom: 'periodicReports',
  },
  // Same document, but over ids sampled from type='Progress' only — this is what
  // actually exercises the ProgressReport fragment (status, the three summaries,
  // prompt responses, product progress).
  {
    key: 'progressReport.byId',
    document: periodicReportById,
    idsFrom: 'progressReports',
  },
  { key: 'progressReports.list.default', document: progressReportsList },
  {
    key: 'progressReports.list.filter-status-notStarted',
    document: progressReportsList,
    variables: { input: { filter: { status: ['NotStarted'] } } },
  },

  // ─── comments + posts ─────────────────────────────────────────────────────
  {
    key: 'commentThread.byId',
    document: commentThreadById,
    idsFrom: 'commentThreads',
  },
  { key: 'post.byId', document: postById, idsFrom: 'posts' },
];
