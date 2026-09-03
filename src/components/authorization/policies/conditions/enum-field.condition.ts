import { groupBy, type NonEmptyArray } from '@seedcompany/common';
import { type Query } from 'cypher-query-builder';
import { sql } from 'drizzle-orm';
import { get, startCase } from 'lodash';
import type { Get, Paths } from 'type-fest';
import { inspect, type InspectOptionsStylized } from 'util';
import {
  type ResourceShape,
  unwrapSecured,
  type UnwrapSecured,
} from '~/common';
import {
  type Condition,
  eqlInLiteralSet,
  type IsAllowedParams,
  MissingContextException,
} from '../../policy/conditions';

export class EnumFieldCondition<
  TResourceStatic extends ResourceShape<any>,
  Path extends Paths<InstanceType<TResourceStatic>> & string,
> implements Condition<TResourceStatic> {
  constructor(
    private readonly path: Path,
    private readonly allowed: ReadonlySet<ValueOfPath<TResourceStatic, Path>>,
    private readonly customId?: string,
  ) {}

  isAllowed({ object }: IsAllowedParams<TResourceStatic>) {
    // Double check at runtime that object has these, since they are usually
    // declared from DB, which cannot be verified.
    if (!object) {
      throw new MissingContextException(
        `Needed object's ${this.path} but object wasn't given`,
      );
    }
    const value = get(object, this.path) as
      | Get<InstanceType<TResourceStatic>, Path>
      | undefined;
    const actual = unwrapSecured(value);
    if (!actual) {
      throw new MissingContextException(
        `Needed object's ${this.path} but it wasn't found`,
      );
    }

    return this.allowed.has(actual);
  }

  asCypherCondition(_query: Query) {
    return `false`; // TODO
  }

  asDrizzleCondition() {
    // Deliberately the same answer the Cypher arm above gives, and for the same
    // unfinished reason: this condition reads a path like `project.type`, and
    // turning that into SQL means knowing which table holds the row and how to
    // reach its project — neither of which this class is told. See the
    // post-cutover item on giving that lookup one home.
    //
    // `false` is the honest port, not a shortcut. Filtering rows in the database
    // is what this method is for, and matching Neo4j exactly is the rule for the
    // migration, so this must keep answering what the Cypher arm answers.
    //
    // Nothing reaches it today, which is why returning false costs nothing:
    // `drizzleFilter` has exactly one caller, `applyReadFilter`, and that always
    // asks for the `read` action — while every `field(...)` call site under
    // policies/by-role and policies/by-feature governs edit, create, delete or
    // execute instead. The arm exists so Postgres answers what Cypher answers the
    // day someone writes a policy condition-first. Do NOT "fix" it by writing a
    // filter this migration is supposed to leave unchanged.
    //
    // ⚠️ It does NOT mean the grants naming this condition are dead. A condition
    // governs the actions written AFTER it — `perm-granter.ts` stores
    // `stagedCondition ?? true` when an action getter runs — so a `.read` written
    // BEFORE `.whenAll(...)` is stored unconditional and the condition applies to
    // what follows. Multiplication Finance Approver's read is exactly that shape
    // and is live; Project Manager's momentum grant has no `read` in it at all
    // and is decided in memory by `isAllowed`, where the condition reads
    // `project.type` off the object and works.
    return sql`false`;
  }

  asEdgeQLCondition() {
    return '<str>' + eqlInLiteralSet(`.${this.path}`, this.allowed);
  }

  union(this: void, conditions: NonEmptyArray<this>) {
    return groupBy(conditions, (c) => c.path).map((conditionsForField) => {
      const unioned = conditionsForField.flatMap((c) => [...c.allowed]);
      return new EnumFieldCondition(
        conditionsForField[0].path,
        new Set(unioned),
        conditions.length === 1 ? conditions[0].customId : undefined,
      );
    });
  }

  intersect(this: void, conditions: NonEmptyArray<this>) {
    return groupBy(conditions, (c) => c.path).map((conditionsForField) => {
      const intersected = [...conditionsForField[0].allowed].filter((v) =>
        conditionsForField.every((condition) => condition.allowed.has(v)),
      );
      return new EnumFieldCondition(
        conditionsForField[0].path,
        new Set(intersected),
        conditions.length === 1 ? conditions[0].customId : undefined,
      );
    });
  }

  [inspect.custom](_depth: number, _options: InspectOptionsStylized) {
    if (this.customId) {
      return this.customId;
    }
    return `${startCase(this.path)} { ${[...this.allowed]
      .map((s) => startCase(s))
      .join(', ')} }`;
  }
}

/**
 * The following actions only apply if the object's field is one of the given allowed values.
 */
export function field<
  TResourceStatic extends ResourceShape<any>,
  Path extends Paths<InstanceType<TResourceStatic>> & string,
>(
  path: Path,
  allowed: ManyIn<ValueOfPath<TResourceStatic, Path>>,
  customId?: string,
) {
  const flattened = new Set(
    // Assume values are strings to normalize cardinality.
    typeof allowed === 'string'
      ? [allowed]
      : [...(allowed as Array<ValueOfPath<TResourceStatic, Path>>)],
  );
  return new EnumFieldCondition<TResourceStatic, Path>(
    path,
    flattened,
    customId,
  );
}

type ManyIn<T extends string> = T | Iterable<T>;

type ValueOfPath<
  TResourceStatic extends ResourceShape<any>,
  Path extends string,
> = UnwrapSecured<Get<InstanceType<TResourceStatic>, Path>>;
