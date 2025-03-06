import { groupBy } from '@seedcompany/common';
import { mapOrElse } from '~/common';
import {
  all,
  AndConditions,
  any,
  Condition,
  Optimizer,
  OrConditions,
} from '../../policy/conditions';
import { RoleCondition } from './role.condition';

/**
 * Optimizes the following condition:
 *
 * (role {x} and X)
 * or
 * (role {y} and X)
 * ==
 * (role {x, y} and X)
 *
 * This is a hot path for us, since our policies are often defined by roles,
 * and multiple policies declare the same conditions.
 * So this helps merge those same conditions across all policies into a single condition, better.
 * Which is an optimization for Gel Access Policies.
 */
@Optimizer.register()
export class RoleAndExpUnionOptimizer implements Optimizer {
  optimize(input: Condition) {
    if (!(input instanceof OrConditions)) {
      return input;
    }
    const [toMerge, remaining] = mapOrElse(
      input.conditions,
      (condition, { ELSE }) => this.isRoleAndX(condition) ?? ELSE,
    );

    const groupedByX = groupBy(toMerge, (c) => c.xId);

    if (!groupedByX.some((s) => s.length > 1)) {
      // If no groups to merge, then maintain condition identity
      return input;
    }

    const merged = groupedByX.map((group) => {
      const { role, x } = group[0]!;
      const roles = role.union(group.map((c) => c.role));
      return all(roles, x);
    });

    return any(...remaining, ...merged);
  }

  isRoleAndX(condition: Condition) {
    if (
      !(condition instanceof AndConditions) ||
      condition.conditions.length !== 2
    ) {
      return null;
    }
    const roleIdx = condition.conditions.findIndex(
      (cc) => cc instanceof RoleCondition,
    );
    if (roleIdx === -1) {
      return null;
    }
    const role = condition.conditions[roleIdx] as RoleCondition;
    const x = condition.conditions[roleIdx === 0 ? 1 : 0];
    const xId = Condition.id(x);
    return { role, x, xId };
  }
}
