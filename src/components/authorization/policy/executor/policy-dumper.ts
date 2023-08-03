import { Injectable } from '@nestjs/common';
import { Nil } from '@seedcompany/common';
import Chalk, { Chalk as ChalkInstance } from 'chalk';
import Table from 'cli-table3';
import { sortBy, startCase } from 'lodash';
import { DateTime } from 'luxon';
import { Command, Console } from 'nestjs-console';
import { keys as keysOf } from 'ts-transformer-keys';
import { inspect } from 'util';
import xlsx from 'xlsx';
import { EnhancedResource, ID, mapFromList, Role, Session } from '~/common';
import { ResourceLike, ResourcesHost } from '~/core';
import {
  ChildListAction,
  ChildSingleAction,
  PropAction,
  ResourceAction,
} from '../actions';
import { Permission } from '../builder/perm-granter';
import { CalculatedCondition, PolicyExecutor } from './policy-executor';

type AnyResource = EnhancedResource<any>;

@Console()
@Injectable()
export class PolicyDumper {
  constructor(
    private readonly resources: ResourcesHost,
    private readonly executor: PolicyExecutor,
  ) {}

  async writeXlsx(filename?: string) {
    const book = xlsx.utils.book_new();

    const chalk = new Chalk.Instance({ level: 0 });
    const resources = await this.selectResources();
    for (const role of Role.all) {
      const dumped = resources.flatMap((res) => this.dumpRes(role, res));
      const data = dumped.map((row) => ({
        Resource: startCase(row.resource.name),
        'Property/Relationship': startCase(row.edge),
        Read: this.humanizePerm(row.read, chalk),
        Edit: this.humanizePerm(row.edit, chalk),
        Create: this.humanizePerm(row.create, chalk),
        Delete: this.humanizePerm(row.delete, chalk),
      }));
      const sheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(book, sheet, startCase(role).slice(0, 31));
    }

    xlsx.writeFile(book, filename ?? 'permissions.xlsx');
  }

  @Command({
    command: 'policy:dump <role> <resource>',
  })
  async dump(role: Role, resource: ResourceLike) {
    const res = await this.resources.enhance(resource);
    const data = this.dumpRes(role, res);

    const table = new Table({
      style: { compact: true },
    });
    const chalk = new Chalk.Instance();

    // Table title
    table.push([
      {
        content: chalk.magentaBright`Permissions for ${chalk.italic(
          startCase(role),
        )} for ${chalk.italic(startCase(res.name))}`,
        colSpan: Object.keys(data[0]).slice(1).length,
        hAlign: 'center',
      },
    ]);

    // Table header row
    table.push([
      undefined,
      ...['Read', 'Edit', 'Create', 'Delete'].map((k) =>
        chalk.magentaBright(k),
      ),
    ]);

    // Table data rows
    table.push(
      ...data.map((row) => [
        chalk.cyan(row.edge ? '.' + row.edge : row.resource.name),
        ...[row.read, row.edit, row.create, row.delete].map((perm) =>
          this.humanizePerm(perm, chalk),
        ),
      ]),
    );

    // eslint-disable-next-line no-console
    console.log(table.toString());
  }

  private async selectResources(...filtered: AnyResource[]) {
    const selectedResources = filtered.length
      ? filtered
      : Object.values<AnyResource>(await this.resources.getEnhancedMap());
    return sortBy(selectedResources, (r) => r.name);
  }

  private humanizePerm(perm: Permission | Nil, chalk: ChalkInstance) {
    if (perm == null) {
      return null;
    }
    if (perm === true) {
      return chalk.green('Yes');
    }
    if (perm === false) {
      return chalk.red('No');
    }
    if (perm instanceof CalculatedCondition) {
      return null;
    }
    return chalk.yellow(inspect(perm));
  }

  private dumpRes(role: Role, resource: AnyResource): DumpedRow[] {
    const session: Session = {
      token: 'system',
      issuedAt: DateTime.now(),
      userId: 'anonymous' as ID,
      anonymous: false,
      roles: [`global:${role}`],
    };
    const resolve = (action: string, prop?: string) =>
      this.executor.resolve({
        session,
        resource,
        calculatedAsCondition: true,
        action,
        prop,
      });
    return [
      {
        resource,
        edge: undefined,
        ...mapFromList(keysOf<Record<ResourceAction, boolean>>(), (action) => [
          action,
          resolve(action),
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
          edge: prop,
          ...mapFromList(actions, (action) => [action, resolve(action, prop)]),
        })),
      ),
    ];
  }
}

interface DumpedRow {
  resource: AnyResource;
  edge?: string;
  read: Permission;
  edit?: Permission;
  create?: Permission;
  delete?: Permission;
}
