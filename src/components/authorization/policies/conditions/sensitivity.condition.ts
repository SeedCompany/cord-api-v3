import { type NonEmptyArray } from '@seedcompany/common';
import { type Query } from 'cypher-query-builder';
import { type SQL, sql } from 'drizzle-orm';
import { inspect, type InspectOptionsStylized } from 'util';
import {
  type EnhancedResource,
  type ResourceShape,
  Sensitivity,
} from '~/common';
import {
  organizationDerivedSensitivity,
  partnerDerivedSensitivity,
} from '~/core/drizzle/derived-sensitivity';
import { matchProjectSens, rankSens } from '~/core/neo4j/query';
import {
  type AsDrizzleParams,
  type AsEdgeQLParams,
  type Condition,
  fqnRelativeTo,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

const sensitivityRank = { High: 3, Medium: 2, Low: 1 };
const CQL_VAR = 'sens';

const EffectiveSensitivity = Symbol('EffectiveSensitivity');

export type HasSensitivity =
  | { sensitivity: Sensitivity }
  | { [EffectiveSensitivity]: Sensitivity };

export class SensitivityCondition<
  TResourceStatic extends
    | ResourceShape<HasSensitivity>
    | (ResourceShape<any> & {
        ConfirmThisClassPassesSensitivityToPolicies: true;
      }),
> implements Condition<TResourceStatic> {
  constructor(private readonly access: Sensitivity) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB which cannot be verified.
    if (!object) {
      throw new MissingContextException();
    }
    const actual: Sensitivity | undefined =
      Reflect.get(object, EffectiveSensitivity) ??
      Reflect.get(object, 'sensitivity');

    if (!actual) {
      throw new MissingContextException(
        "Needed object's sensitivity but object's sensitivity wasn't given",
      );
    }

    return sensitivityRank[actual] <= sensitivityRank[this.access];
  }

  setupCypherContext(query: Query, prevApplied: Set<any>) {
    if (prevApplied.has('sensitivity')) {
      return query;
    }
    prevApplied.add('sensitivity');

    return query.subQuery('project', (sub) =>
      sub
        .apply(matchProjectSens())
        .return(`${rankSens('sensitivity')} as ${CQL_VAR}`),
    );
  }

  asCypherCondition(query: Query) {
    const ranked = sensitivityRank[this.access];
    const param = query.params.addParam(ranked, 'requiredSens');
    return `${CQL_VAR} <= ${String(param)}`;
  }

  asDrizzleCondition({ resource }: AsDrizzleParams<TResourceStatic>) {
    // PG's sensitivity enum is declared in `Low < Medium < High` order, so
    // `node.sensitivity <= 'access'` is a single-column compare. For Project
    // subtypes the column lives on the row directly (denormalized). For
    // Project-scoped children the column is on the parent project; use a
    // correlated subquery.
    return sensitivityRefForResource(resource, this.access);
  }

  setupEdgeQLContext({
    resource,
    namespace,
  }: AsEdgeQLParams<TResourceStatic>): Record<string, string> {
    const Sensitivity = fqnRelativeTo('default::Sensitivity', namespace);
    if (resource.isEmbedded) {
      const eql = `(.container[is Project::ContextAware].sensitivity ?? ${Sensitivity}.High)`;
      return { sensitivity: eql };
    }
    return {};
  }

  asEdgeQLCondition({ resource, namespace }: AsEdgeQLParams<TResourceStatic>) {
    const Sensitivity = fqnRelativeTo('default::Sensitivity', namespace);
    const lhs = resource.isEmbedded ? 'sensitivity' : '.sensitivity';
    const rhs = `${Sensitivity}.${this.access}`;
    return `${lhs} <= ${rhs}`;
  }

  union(conditions: NonEmptyArray<this>) {
    return this.pickSens(conditions, 'highest');
  }

  intersect(conditions: NonEmptyArray<this>) {
    return this.pickSens(conditions, 'lowest');
  }

  private pickSens(
    conditions: NonEmptyArray<this>,
    sort: 'highest' | 'lowest',
  ) {
    const ranked = conditions.toSorted(
      sort === 'highest'
        ? (a, b) => sensitivityRank[b.access] - sensitivityRank[a.access]
        : (a, b) => sensitivityRank[a.access] - sensitivityRank[b.access],
    );
    return ranked[0]!;
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    const map = {
      High: 'Any',
      Medium: 'Medium/Low',
      Low: 'Low',
    };
    return `Sens ${map[this.access]}`;
  }
}

/**
 * The following actions only apply if the object's sensitivity is Medium or Low.
 */
export const sensMediumOrLower = new SensitivityCondition(Sensitivity.Medium);

/**
 * The following actions only apply if the object's sensitivity is Low.
 */
export const sensOnlyLow = new SensitivityCondition(Sensitivity.Low);

/**
 * Specify sensitivity that should be used for the sensitivity condition.
 * This is useful when the object doesn't have a `sensitivity` property or
 * a different/"effective" sensitivity should be used for this logic.
 */
export const withEffectiveSensitivity = <T extends object>(
  obj: T,
  sensitivity: Sensitivity,
) =>
  Object.defineProperty(obj, EffectiveSensitivity, {
    value: sensitivity,
    enumerable: false,
  }) as T & { [EffectiveSensitivity]: Sensitivity };

/**
 * Build the `sensitivity <= access` SQL fragment for `resource`. Project rows
 * carry the denormalized column directly; project-scoped child resources read
 * it via a correlated subquery against `projects`. Add cases here as each
 * domain ports to Postgres.
 */
const sensitivityRefForResource = (
  resource: EnhancedResource<any>,
  access: Sensitivity,
): SQL => {
  const accessLiteral = sql.raw(`'${access}'::"sensitivity"`);
  switch (resource.name) {
    case 'Project':
    case 'TranslationProject':
    case 'MomentumTranslationProject':
    case 'MultiplicationTranslationProject':
    case 'InternshipProject':
      return sql`"projects"."sensitivity" <= ${accessLiteral}`;
    case 'ProjectMember':
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        where "p"."id" = "project_members"."project_id"
      ) <= ${accessLiteral}`;
    case 'Partnership':
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        where "p"."id" = "partnerships"."project_id"
      ) <= ${accessLiteral}`;
    case 'Budget':
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        where "p"."id" = "budgets"."project_id"
      ) <= ${accessLiteral}`;
    case 'BudgetRecord':
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        join "budgets" "b" on "b"."project_id" = "p"."id"
        where "b"."id" = "budget_records"."budget_id"
      ) <= ${accessLiteral}`;
    case 'Partner':
      // Derived from the connected projects, like every other case here. This
      // used to read the denormalized `partners.sensitivity` column, which was
      // meant to be a temporary fail-closed default until the surrounding
      // domains migrated. They did; the derivation was never wired; and the
      // column has since been holding whatever the data migration loaded,
      // with nothing keeping it current. A stale value here is not cosmetic —
      // this clause decides who can see the record.
      return sql`${partnerDerivedSensitivity(
        sql`"partners"."id"`,
      )} <= ${accessLiteral}`;
    case 'Organization':
      // Same as Partner, one hop further out through its partners.
      return sql`${organizationDerivedSensitivity(
        sql`"organizations"."id"`,
      )} <= ${accessLiteral}`;
    case 'Engagement':
    case 'LanguageEngagement':
    case 'InternshipEngagement':
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        where "p"."id" = "engagements"."project_id"
      ) <= ${accessLiteral}`;
    case 'Ceremony':
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        join "engagements" "e" on "e"."project_id" = "p"."id"
        where "e"."id" = "ceremonies"."engagement_id"
      ) <= ${accessLiteral}`;
    case 'ProgressReport':
      // Progress rows on the shared periodic_reports table are always
      // engagement-parented (never project-parented directly) — see
      // PeriodicReportDrizzleRepository.parentCondition.
      return sql`(
        select "p"."sensitivity" from "projects" "p"
        join "engagements" "e" on "e"."project_id" = "p"."id"
        where "e"."id" = "periodic_reports"."engagement_id"
      ) <= ${accessLiteral}`;
    case 'Language':
      // Effective sensitivity: lowest across projects engaging the language,
      // falling back to the language's own (user-set) sensitivity when
      // unengaged — mirror of the Neo4j hydrate's rankSens ASC pick.
      // DELIBERATE divergence from Neo4j's DB-level filter: matchProjectSens
      // hard-codes 'High' for the no-project case, so an unengaged Low
      // language is invisible to a sens-gated read under Neo4j but visible
      // here. The own-sensitivity fallback matches Gel + the hydrate (and
      // Neo4j's own TODO); currently unreachable since no policy sens-gates
      // Language object reads — if one ever does, this is the intended
      // behavior, not a bug.
      return sql`coalesce((
        select min("p"."sensitivity") from "projects" "p"
        join "engagements" "e" on "e"."project_id" = "p"."id"
        where "e"."language_id" = "languages"."id"
          and "e"."deleted_at" is null
          and "p"."deleted_at" is null
      ), "languages"."sensitivity") <= ${accessLiteral}`;
    // migration-todo: re-add a case per domain as it ports to Postgres
    // (Engagement/Ceremony/Language read sensitivity via
    // their parent project). Kept stripped so an unmigrated domain routed
    // through Drizzle fails loud here instead of emitting SQL against a
    // missing table.
    //
    // migration-todo: these subselects don't check `projects.deleted_at` —
    // same soft-deleted-project liveness class as projectIdRefForResource in
    // member.condition.ts; disposition together at the pre-cutover audit.
    default:
      throw new Error(
        `SensitivityCondition.asDrizzleCondition: resource ${resource.name} not configured for Drizzle yet; add a case when it migrates.`,
      );
  }
};
