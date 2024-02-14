import { Injectable } from '@nestjs/common';
import {
  cleanJoin,
  csv,
  groupBy,
  isNotFalsy,
  many,
  Many,
  mapValues,
  Nil,
  setOf,
  sortBy,
} from '@seedcompany/common';
import { Chalk, ChalkInstance } from 'chalk';
import Table from 'cli-table3';
import { startCase } from 'lodash';
import { DateTime } from 'luxon';
import { Command, Console } from 'nestjs-console';
import fs from 'node:fs/promises';
import { keys as keysOf } from 'ts-transformer-keys';
import { LiteralUnion } from 'type-fest';
import { inspect } from 'util';
import xlsx from 'xlsx';
import { EnhancedResource, firstOr, ID, Role, Session } from '~/common';
import { searchCamelCase } from '~/common/search-camel-case';
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

    const chalk = new Chalk({ level: 0 });
    const resources = this.selectResources();
    for (const role of Role) {
      const dumped = resources.flatMap((res) =>
        this.dumpRes(role, res, { props: true }),
      );
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

    const buffer: Buffer = xlsx.write(book, { type: 'buffer' });
    await fs.writeFile(filename ?? 'permissions.xlsx', buffer);
  }

  @Command({
    command: 'policy:dump <role> <resource>',
  })
  async dump(
    rolesIn: Many<LiteralUnion<Role, string>>,
    resourcesIn: Many<ResourceLike & string>,
  ) {
    const roles = search(rolesIn, [...Role], 'role');
    const map = this.resources.getEnhancedMap();
    const resources = searchResources(resourcesIn, map);

    const data = roles.flatMap((role) =>
      resources.flatMap((r) =>
        this.dumpRes(role, r.resource, { props: r.props }),
      ),
    );

    const table = new Table({
      style: { compact: true },
    });
    const chalk = new Chalk();

    const showRoleCol = roles.length > 1;
    const showResCol =
      !showRoleCol || resources.length > 1 || resources.some((r) => r.props);

    // Table title
    table.push([
      {
        content: chalk.magentaBright(
          cleanJoin(' ', [
            'Permissions',
            roles.length === 1 && `for ${chalk.italic(startCase(roles[0]))}`,
            resources.length === 1 &&
              `for ${chalk.italic(startCase(resources[0].resource.name))}`,
          ]),
        ),
        colSpan: 4 + (showRoleCol ? 1 : 0) + (showResCol ? 1 : 0),
        hAlign: 'center',
      },
    ]);

    // Table header row
    table.push([
      ...(showRoleCol ? [chalk.magentaBright('Role')] : []),
      ...(showResCol
        ? [resources.length === 1 ? undefined : chalk.magentaBright('Resource')]
        : []),
      ...['Read', 'Edit', 'Create', 'Delete'].map((k) =>
        chalk.magentaBright(k),
      ),
    ]);

    // Table data rows
    table.push(
      ...data.map((row) => [
        ...(showRoleCol ? [chalk.cyan(startCase(row.role))] : []),
        ...(showResCol
          ? [
              chalk.cyan(
                row.edge ? ' .' + row.edge : startCase(row.resource.name),
              ),
            ]
          : []),
        ...[row.read, row.edit, row.create, row.delete].map((perm) =>
          this.humanizePerm(perm, chalk),
        ),
      ]),
    );

    // eslint-disable-next-line no-console
    console.log(table.toString());
  }

  private selectResources(...filtered: AnyResource[]) {
    const selectedResources = filtered.length
      ? filtered
      : Object.values<AnyResource>(this.resources.getEnhancedMap());
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

  private dumpRes(
    role: Role,
    resource: AnyResource,
    options: { props: boolean | ReadonlySet<string> },
  ): DumpedRow[] {
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
        optimizeConditions: true,
        action,
        prop,
      });
    return [
      {
        role,
        resource,
        edge: undefined,
        ...mapValues.fromList(
          keysOf<Record<ResourceAction, boolean>>(),
          (action) => resolve(action),
        ).asRecord,
      },
      ...(options.props !== false
        ? ([
            [resource.securedPropsPlusExtra, keysOf<Record<PropAction, ''>>()],
            [resource.childSingleKeys, keysOf<Record<ChildSingleAction, ''>>()],
            [resource.childListKeys, keysOf<Record<ChildListAction, ''>>()],
          ] as const)
        : []
      ).flatMap(([set, actions]) =>
        [...set]
          .filter(
            (p) => typeof options.props === 'boolean' || options.props.has(p),
          )
          .map((prop) => ({
            role,
            resource,
            edge: prop,
            ...mapValues.fromList(actions, (action) => resolve(action, prop))
              .asRecord,
          })),
      ),
    ];
  }
}

interface DumpedRow {
  role: Role;
  resource: AnyResource;
  edge?: string;
  read: Permission;
  edit?: Permission;
  create?: Permission;
  delete?: Permission;
}

const search = <T extends string>(
  input: Many<string>,
  bank: T[],
  thing: string,
) => {
  const values = many(input);
  if (values.some(isWildcard)) {
    return bank;
  }
  const results = values
    .flatMap(csv)
    .map((r) =>
      firstOr(
        searchCamelCase(bank, r),
        () => new Error(`Could not find ${thing} from "${r}"`),
      ),
    );
  return [...new Set(results)].sort((a, b) => a.localeCompare(b));
};

const searchResources = (
  input: Many<string>,
  map: Record<string, AnyResource>,
) => {
  const resNames = Object.keys(map);
  const selections = many(input)
    // Split by comma, but not inside curly braces
    .flatMap((str) =>
      str
        .split(/,(?![^{}]*})/g)
        .map((s) => s.trim())
        .filter(isNotFalsy),
    )
    // Expand resource wildcards/multi-selects, split out props into tuple
    .flatMap((r) => {
      let propsIn: string | undefined;
      [r, propsIn] = r.split('.');
      propsIn = propsIn?.replace(/[{}]/g, '');
      if (isWildcard(r)) {
        return resNames.map((n) => [n, propsIn] as const);
      }
      r = r?.replace(/[{}]/g, '');
      return csv(r).map((n) => [n, propsIn] as const);
    })
    .flatMap(([r, propsIn]) => {
      const resName = firstOr(
        searchCamelCase(resNames, r),
        () => new Error(`Could not find resource from "${r}"`),
      );
      const resource = map[resName];

      if (!propsIn) {
        return { resource, props: false };
      }

      const availableProps = setOf<string>([
        ...resource.securedPropsPlusExtra,
        ...resource.childKeys,
      ]);

      if (isWildcard(propsIn)) {
        return { resource, props: availableProps };
      }

      const found = csv(propsIn).flatMap((p) =>
        searchCamelCase(availableProps, p),
      );
      return { resource, props: setOf(found) };
    });

  // Dedupe selections and sort alphabetically
  return groupBy(selections, (s) => s.resource.name)
    .map((rows) => {
      const resource = rows[0]!.resource;
      const propList = [
        ...new Set(
          ...rows.flatMap((r) => (typeof r.props === 'boolean' ? [] : r.props)),
        ),
      ].sort((a, b) => a.localeCompare(b));
      const props = propList.length === 0 ? false : setOf(propList);
      return { resource, props };
    })
    .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
};

const isWildcard = (str: string) => str === '*' || str === '_';
