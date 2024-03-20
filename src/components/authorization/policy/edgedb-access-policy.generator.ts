import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { mapEntries } from '@seedcompany/common';
import addIndent from 'indent-string';
import { startCase } from 'lodash';
import { EnhancedResource } from '~/common';
import { ResourceAction } from './actions';
import { Permission } from './builder/perm-granter';
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

    const policies = [...actionPerms].map(([action, perm]) => {
      return this.makeSdlForAction(resource, action, perm);
    });

    return policies.join('\n\n');
  }

  makeSdlForAction(
    resource: EnhancedResource<any>,
    stmtType: string,
    perm: Permission,
  ) {
    const name = `Can${startCase(stmtType)}GeneratedFromAppPoliciesFor${
      resource.name
    }`;

    const usingBodyEql =
      typeof perm === 'boolean'
        ? String(perm)
        : perm.asEdgeQLCondition({ resource });

    const usingEql = ` using (\n${addIndent(usingBodyEql, 1, {
      indent: '  ',
    })}\n)`;
    const sdl = `access policy ${name}\nallow ${stmtType}${usingEql};`;
    return sdl;
  }
}
