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
 */

// ─── users ───────────────────────────────────────────────────────────────────
// Excluded: isIntern (engagement-derived; PG stubs it — migration-todo in
//   user.drizzle.repository.ts), pinned (Pin domain not migrated).
// Excluded: knownLanguages (Language not landed).
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
      # items excluded on the three lists below:
      # - organizations/partners: userId-filtered from-user reads are not
      #   validated on PG yet; can* perms are policy-driven (engine-agnostic).
      # - locations: PG listLocationsFromNode is an EMPTY_PAGE stub
      #   (migration-todo in location.drizzle.repository.ts).
      organizations { canRead canCreate }
      partners { canRead canCreate }
      locations { canRead canCreate }
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
// Excluded: locations sub-list (PG listLocationsFromNode is an EMPTY_PAGE
//   stub — migration-todo in location.drizzle.repository.ts).
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
// Excluded: languageOfWiderCommunication / languageOfReporting /
//   languagesOfConsulting (Language not landed on PG).
// Excluded: pinned (Pin domain not migrated; PG stubs false).
// Excluded: projects / languages / engagements / people sub-lists — cross-
//   domain lists; projects has its own corpus entries, the rest aren't landed.
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
// Excluded: pinned (Pin stub), engagementTotal (stubbed 0 until Engagement
//   migrates), engagements (Engagement not landed), primaryPartnership (PG
//   hydrates null — migration-todo in project.drizzle.repository.ts),
//   budget/changeRequests (Budget/PCR not landed / excluded from migration).
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
];
