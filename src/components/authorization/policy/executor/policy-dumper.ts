import { Injectable } from '@nestjs/common';
import { mapKeys, mapValues, sortBy, startCase } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { inspect } from 'util';
import xlsx from 'xlsx';
import { EnhancedResource, mapFromList, Session } from '~/common';
import { ConfigService, ResourcesHost } from '~/core';
import { AuthenticationService } from '../../../authentication';
import { Role } from '../../dto';
import {
  ChildListAction,
  ChildSingleAction,
  PropAction,
  ResourceAction,
} from '../actions';
import { Permission } from '../builder/perm-granter';
import { CalculatedCondition, PolicyExecutor } from './policy-executor';

interface DumpedRow {
  resource: EnhancedResource<any>;
  edge?: string;
  read: Permission;
  edit?: Permission;
  create?: Permission;
  delete?: Permission;
}

@Injectable()
export class PolicyDumper {
  constructor(
    private readonly resources: ResourcesHost,
    private readonly executor: PolicyExecutor,
    private readonly auth: AuthenticationService,
    private readonly config: ConfigService
  ) {}

  async write(filename?: string) {
    const book = xlsx.utils.book_new();

    for (const role of Object.keys(Role) as Role[]) {
      const data = await this.dumpFor(role);
      const sheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(book, sheet, startCase(role).slice(0, 31));
    }

    xlsx.writeFile(book, filename ?? 'permissions.xlsx');
  }

  private async dumpFor(role: Role) {
    const session: Session = {
      ...(await this.auth.sessionForUser(this.config.rootAdmin.id)),
      roles: [`global:${role}`],
    };

    const map = await this.resources.getEnhancedMap();
    const data = sortBy(Object.values(map), (r) => r.name).flatMap((resource) =>
      this.dumpRes(session, resource)
    );
    const headerMap = {
      resource: 'Resource',
      edge: 'Property/Relationship',
      read: 'Read',
      edit: 'Update',
      create: 'Create',
      delete: 'Delete',
    };
    return data.map((row) =>
      mapKeys(
        mapValues(row, (v) => {
          if (v == null || typeof v === 'string') {
            return v;
          }
          if (v === true) {
            return 'Yes';
          }
          if (v === false) {
            return 'No';
          }
          if (v instanceof EnhancedResource) {
            return startCase(v.name);
          }
          if (v instanceof CalculatedCondition) {
            return null;
          }
          return inspect(v);
        }),
        (_, k) => (headerMap as any)[k] ?? k
      )
    );
  }

  private dumpRes(
    session: Session,
    resource: EnhancedResource<any>
  ): DumpedRow[] {
    const opts = { session, resource, calculatedAsCondition: true };
    return [
      {
        resource,
        edge: undefined,
        ...mapFromList(keysOf<Record<ResourceAction, boolean>>(), (action) => [
          action,
          this.executor.resolve({ ...opts, action }),
        ]),
      },
      ...(
        [
          [resource.securedPropsPlusExtra, keysOf<Record<PropAction, ''>>()],
          [resource.childSingleKeys, keysOf<Record<ChildSingleAction, ''>>()],
          [resource.childListKeys, keysOf<Record<ChildListAction, ''>>()],
        ] as const
      ).flatMap(([set, actions]) =>
        [...set].map((prop) => ({
          resource,
          edge: startCase(prop),
          ...mapFromList(actions, (action) => [
            action,
            this.executor.resolve({ ...opts, action, prop }),
          ]),
        }))
      ),
    ];
  }
}
