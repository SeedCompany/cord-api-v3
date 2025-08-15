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
        .apply(matchProps({ nodeName: 'tool', outputVar: 'toolProps' }))
        .return<{ dto: UnsecuredDto<ToolUsage> }>(
          merge('node', {
            container: 'container',
            tool: 'toolProps',
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
        container: { id: ID };
        usages: ReadonlyArray<UnsecuredDto<ToolUsage>>;
      }>(['container { .id }', 'usages'])
      .run();
    return result;
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
