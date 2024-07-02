import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { cleanJoin, entries, groupBy, mapEntries } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import addIndent from 'indent-string';
import { startCase } from 'lodash';
import { ResourceAction } from './actions';
import { Permission } from './builder/perm-granter';
import { AsEdgeQLParams, Condition } from './conditions';
import { PolicyExecutor } from './executor/policy-executor';

@Injectable()
export class EdgeDBAccessPolicyGenerator {
  constructor(
    @Inject(forwardRef(() => PolicyExecutor))
    private readonly executor: PolicyExecutor & {},
  ) {}

  makeSdl(params: AsEdgeQLParams<any>) {
    const { resource } = params;

    if (!resource.generateAccessPolicies) {
      return undefined;
    }

    const actions = {
      select: 'read',
      'update read': 'read',
      'update write': 'edit',
      insert: 'create',
      delete: 'delete',
    } as const satisfies Record<string, ResourceAction>;

    const actionPerms = mapEntries(entries(actions), ([dbAction, action]) => [
      dbAction,
      this.executor.forEdgeDB({ resource, action }),
    ]);

    const policies = groupBy(actionPerms, ([_, perm]) =>
      Condition.id(perm),
    ).map((group) => {
      const actions = group.map(([action]) => action);
      const perm = group[0][1];
      return this.makeSdlForAction(params, actions, perm);
    });

    return cleanJoin('\n\n', policies);
  }

  makeSdlForAction(
    params: AsEdgeQLParams<any>,
    stmtTypes: string[],
    perm: Permission,
  ) {
    if (perm === false) {
      // App policies haven't declared any perms for this specific type.
      return null;
    }

    const name = `Can${stmtTypes
      .map((action) => startCase(action).replaceAll(/\s+/g, ''))
      .join('')}GeneratedFromAppPoliciesFor${params.resource.name}`;

    const withAliases =
      typeof perm === 'boolean' ? {} : perm.setupEdgeQLContext?.(params) ?? {};
    const withAliasesEql = Object.entries(withAliases)
      .map(([key, value]) => `${key} := ${value}`)
      .join(',\n');

    const conditionEql =
      typeof perm === 'boolean' ? String(perm) : perm.asEdgeQLCondition(params);

    const usingBodyEql = withAliasesEql
      ? stripIndent`
          with
${addIndent(withAliasesEql, 6, { indent: '  ' })}
          select (
${addIndent(conditionEql, 6, { indent: '  ' })}
          )
        `
      : conditionEql;

    const usingEql =
      perm === true
        ? ''
        : ` using (\n${addIndent(usingBodyEql, 1, { indent: '  ' })}\n)`;
    const actions = stmtTypes.join(', ');
    const sdl = `access policy ${name}\nallow ${actions}${usingEql};`;
    return sdl;
  }
}
