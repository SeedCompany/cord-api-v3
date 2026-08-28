import { inArray, sql, type SQL } from 'drizzle-orm';
import { type ID, type Sensitivity } from '~/common';
import { type DrizzleDb } from './drizzle.service';
import { organizations, partners } from './schema';

/**
 * A partner's or organization's sensitivity, computed from the projects it is
 * connected to — the lowest of them, or `High` when there are none.
 *
 * Neo4j computes this on every read and stores nothing
 * (`partner.repository.ts` / `organization.repository.ts`: collect the
 * projects, `ORDER BY rankSens ASC LIMIT 1`, `UNION` a `'High'` branch for the
 * no-project case). Postgres carried a denormalized `sensitivity` column
 * instead, defaulted to `'High'`, on the understanding that the real
 * derivation would be wired once the surrounding domains migrated. They have,
 * and it was not — so the column has been holding whatever the data migration
 * loaded into it, with nothing to keep it current.
 *
 * Deriving it in the query rather than maintaining a stored copy is a
 * deliberate choice, for three reasons:
 *
 * 1. **It cannot go stale.** A stored copy has to be refreshed on partnership
 *    create, delete and soft-delete, on every change to a project's own
 *    sensitivity (itself derived), and again across the extra hop to the
 *    organization. Missing any one of those arms reintroduces the same silent
 *    drift, in a value that decides who can see the record.
 * 2. **It is what every neighbouring resource already does.** Partnership,
 *    Budget, BudgetRecord, Engagement, Ceremony, ProjectMember and
 *    ProgressReport all reach their project's sensitivity through a correlated
 *    subquery. Partner and Organization were the only two reading a column.
 * 3. **It matches the other engine by construction** rather than by
 *    maintenance, so the two agree for a structural reason.
 *
 * `min()` gives the lowest because the enum is declared `Low, Medium, High` —
 * Postgres orders enum values by declaration, so the ordering the comparison
 * `sensitivity <= 'access'` already relies on is the same one used here.
 *
 * Soft-deleted partnerships and projects are excluded: a partnership that has
 * been removed should stop lowering the partner's sensitivity, which is the
 * behaviour on the other engine, where a deleted node no longer matches.
 */
export const partnerDerivedSensitivity = (
  partnerIdRef: SQL,
): SQL<Sensitivity> => sql`coalesce(
  (
    select min("p"."sensitivity")
    from "projects" "p"
    join "partnerships" "pship" on "pship"."project_id" = "p"."id"
    where "pship"."partner_id" = ${partnerIdRef}
      and "pship"."deleted_at" is null
      and "p"."deleted_at" is null
  ),
  'High'::"sensitivity"
)`;

/**
 * The same value for an organization, which reaches projects one hop further
 * out — through the partners that belong to it.
 *
 * Kept separate from {@link partnerDerivedSensitivity} rather than sharing a
 * parameterized join: the two walk different paths, and collapsing them would
 * hide that an organization's answer depends on its partners' partnerships
 * while a partner's does not. See `organization.repository.ts`, whose Cypher
 * spells out the longer path for the same reason.
 */
export const organizationDerivedSensitivity = (
  organizationIdRef: SQL,
): SQL<Sensitivity> => sql`coalesce(
  (
    select min("p"."sensitivity")
    from "projects" "p"
    join "partnerships" "pship" on "pship"."project_id" = "p"."id"
    join "partners" "pt" on "pt"."id" = "pship"."partner_id"
    where "pt"."organization_id" = ${organizationIdRef}
      and "pt"."deleted_at" is null
      and "pship"."deleted_at" is null
      and "p"."deleted_at" is null
  ),
  'High'::"sensitivity"
)`;

/**
 * The derived sensitivity for a page of partners, keyed by id.
 *
 * Hydration counterpart to the expressions above, in the same shape as
 * `pinnedByRequester`: the read paths build their rows through Drizzle's
 * relational query API, which returns table columns, so a value computed from
 * other tables is looked up for the whole page and merged in.
 *
 * Both halves are deliberately built from the one expression. If they drifted,
 * a record could be *filtered* by one sensitivity and *displayed* with
 * another — worse than either being wrong alone, because nothing about the
 * result would look inconsistent.
 */
export const derivedSensitivityByPartner = async (
  db: DrizzleDb,
  ids: readonly ID[],
): Promise<Map<ID, Sensitivity>> => {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: partners.id,
      sensitivity: partnerDerivedSensitivity(sql`${partners.id}`),
    })
    .from(partners)
    .where(inArray(partners.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.sensitivity]));
};

/** The same for a page of organizations. */
export const derivedSensitivityByOrganization = async (
  db: DrizzleDb,
  ids: readonly ID[],
): Promise<Map<ID, Sensitivity>> => {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      id: organizations.id,
      sensitivity: organizationDerivedSensitivity(sql`${organizations.id}`),
    })
    .from(organizations)
    .where(inArray(organizations.id, [...ids]));
  return new Map(rows.map((row) => [row.id, row.sensitivity]));
};
