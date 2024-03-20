import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { cleanJoin, groupBy, mapEntries } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import addIndent from 'indent-string';
import { startCase } from 'lodash';
import { EnhancedResource } from '~/common';
import { ResourceAction } from './actions';
import { Permission } from './builder/perm-granter';
import { Condition } from './conditions';
import { PolicyExecutor } from './executor/policy-executor';

@Injectable()
export class EdgeDBAccessPolicyGenerator {
  constructor(
    @Inject(forwardRef(() => PolicyExecutor))
    private readonly executor: PolicyExecutor & {},
  ) {}

  makeSdl(resource: EnhancedResource<any>) {
    const actions = {
      read: 'select',
      create: 'insert',
      delete: 'delete',
      // edit: 'update', // need fine grain; will handle at app level
    } as const satisfies { [_ in ResourceAction]?: string };

    const actionPerms = mapEntries(actions, ([action, dbAction]) => [
      dbAction,
      this.executor.forEdgeDB({ resource, action }),
    ]);

    const policies = groupBy(actionPerms, ([_, perm]) =>
      Condition.id(perm),
    ).map((group) => {
      const actions = group.map(([action]) => action);
      const perm = group[0][1];
      return this.makeSdlForAction(resource, actions, perm);
    });

    return cleanJoin('\n\n', policies);
  }

  makeSdlForAction(
    resource: EnhancedResource<any>,
    stmtTypes: string[],
    perm: Permission,
  ) {
    if (perm === false) {
      // App policies haven't declared any perms for this specific type.
      return null;
    }

    const name = `Can${stmtTypes
      .map((action) => startCase(action))
      .join('')}GeneratedFromAppPoliciesFor${resource.name}`;

    const withAliases =
      typeof perm === 'boolean'
        ? {}
        : perm.setupEdgeQLContext?.({ resource }) ?? {};
    const withAliasesEql = Object.entries(withAliases)
      .map(([key, value]) => `${key} := ${value}`)
      .join(',\n');

    const conditionEql =
      typeof perm === 'boolean'
        ? String(perm)
        : perm.asEdgeQLCondition({ resource });

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
