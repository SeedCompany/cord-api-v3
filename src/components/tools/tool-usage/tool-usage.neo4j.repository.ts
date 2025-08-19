import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { CreationFailed, type ID, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  collect,
  createNode,
  createRelationships,
  currentUser,
  filter,
  matchProps,
  merge,
  variable,
} from '~/core/database/query';
import { type BaseNode } from '~/core/database/results';
import { toolFilters } from '../tool/tool.neo4j.repository';
import {
  type CreateToolUsage,
  ToolUsage,
  ToolUsageFilters,
  type UpdateToolUsage,
} from './dto';

@Injectable()
export class ToolUsageRepository extends DtoRepository(ToolUsage) {
  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('container', 'BaseNode'),
          relation('out', '', 'uses', ACTIVE),
          node('node'),
        ])
        .match([
          node('node'),
          relation('out', '', 'tool'),
          node('tool', 'Tool'),
        ])
        .match([
          node('node'),
          relation('out', '', 'creator'),
          node('creator', 'Actor'),
        ])
        .apply(matchProps({ nodeName: 'tool', outputVar: 'toolProps' }))
        .return<{ dto: UnsecuredDto<ToolUsage> }>(
          merge('props', {
            container: 'container',
            tool: 'toolProps',
            creator: 'creator { .id }',
          }).as('dto'),
        );
  }

  async listForContainers(containers: readonly ID[]) {
    const result = await this.db
      .query()
      .unwind([...containers], 'containerId')
      .match(node('container', 'BaseNode', { id: variable('containerId') }))
      .subQuery('container', (sub) =>
        sub
          .match([
            node('container'),
            relation('out', '', 'uses', ACTIVE),
            node('node', 'ToolUsage'),
          ])
          .subQuery('node', this.hydrate())
          .return(collect('dto').as('usages')),
      )
      .return<{
        container: BaseNode;
        usages: ReadonlyArray<UnsecuredDto<ToolUsage>>;
      }>(['container', 'usages'])
      .run();
    return result;
  }

  async listForTools(tools: readonly ID[]) {
    const result = await this.db
      .query()
      .unwind([...tools], 'toolId')
      .match(node('tool', 'Tool', { id: variable('toolId') }))
      .subQuery('tool', (sub) =>
        sub
          .match([
            node('node', 'ToolUsage'),
            relation('out', '', 'tool', ACTIVE),
            node('tool'),
          ])
          .subQuery('node', this.hydrate())
          .return(collect('dto').as('usages')),
      )
      .return<{
        tool: { id: ID };
        usages: ReadonlyArray<UnsecuredDto<ToolUsage>>;
      }>(['tool { .id }', 'usages'])
      .run();
    return result;
  }

  async usageFor(container: ID<'Resource'>, tool: ID<'Tool'>) {
    const res = await this.db
      .query()
      .match([
        node('container', 'BaseNode', { id: container }),
        relation('out', '', 'uses', ACTIVE),
        node('node', 'ToolUsage'),
        relation('out', '', 'tool', ACTIVE),
        node('tool', 'Tool', { id: tool }),
      ])
      .apply(this.hydrate())
      .first();
    return res?.dto ?? null;
  }

  async create(input: CreateToolUsage) {
    const initialProps = {
      startDate: input.startDate,
    };
    const result = await this.db
      .query()
      .apply(await createNode(ToolUsage, { initialProps }))
      .apply(
        createRelationships(ToolUsage, {
          in: {
            uses: ['BaseNode', input.container],
          },
          out: {
            tool: ['Tool', input.tool],
            creator: currentUser,
          },
        }),
      )
      .apply(this.hydrate())
      .map('dto')
      .first();

    if (!result) {
      throw new CreationFailed(ToolUsage);
    }
    return result;
  }

  async update(changes: UpdateToolUsage) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    return await this.readOne(id);
  }
}

export const toolUsageFilters = filter.define(() => ToolUsageFilters, {
  tool: filter.sub(() => toolFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'tool'),
      node('node', 'Tool'),
    ]),
  ),
});
