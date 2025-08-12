import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { CreationFailed, type ID, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  defineSorters,
  filter,
  matchProps,
  merge,
  variable,
} from '~/core/database/query';
import { type Tool } from '../dto';
import { toolFilters } from '../tool.repository';
import {
  type CreateToolUsage,
  ToolUsage,
  ToolUsageFilters,
  type UpdateToolUsage,
} from './dto';

@Injectable()
export class ToolUsageRepository extends DtoRepository(ToolUsage) {
  async create(input: CreateToolUsage): Promise<UnsecuredDto<ToolUsage>> {
    const initialProps = {
      startDate: input.startDate,
    };
    const result = await this.db
      .query()
      .apply(await createNode(ToolUsage, { initialProps }))
      .apply(
        createRelationships(ToolUsage, {
          out: {
            container: ['BaseNode', input.container],
            tool: ['Tool', input.tool],
          },
        }),
      )
      .return<UnsecuredDto<ToolUsage>>('node.id as id')
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

  async findByContainerResourceIds(resourceRefs: Array<{ resourceId: ID }>) {
    if (resourceRefs.length === 0) return [];
    const result = await this.db
      .query()
      .unwind(resourceRefs, 'input')
      .match([
        node('container', 'BaseNode', { id: variable('input.resourceId') }),
        relation('in', 'containerRel', 'container', ACTIVE),
        node('usage', 'ToolUsage'),
        relation('out', 'toolRel', 'tool', ACTIVE),
        node('tool', 'Tool'),
      ])
      .return<{ tool: Tool }>(['tool { .id }'])
      .run();
    return result;
  }

  async listAllByEngagementId(engagementId: ID<'Engagement'>) {
    return await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('in', '', 'container', ACTIVE),
        node('node', 'ToolUsage'),
      ])
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'container', ACTIVE),
          node('container', 'BaseNode'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'tool', ACTIVE),
          node('tool', 'Tool'),
        ])
        .return<{ dto: UnsecuredDto<ToolUsage> }>(
          merge('props', {
            container: 'container { .id }',
            tool: 'tool { .id }',
          }).as('dto'),
        );
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

export const locationSorters = defineSorters(ToolUsage, {});
