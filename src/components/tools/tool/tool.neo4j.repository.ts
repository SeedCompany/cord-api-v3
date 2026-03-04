import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  NotFoundException,
  ReadAfterCreationFailed,
  type UnsecuredDto,
} from '~/common';
import { OnIndex } from '~/core/neo4j';
import { DtoRepository } from '~/core/neo4j/dto.repository';
import {
  ACTIVE,
  createNode,
  filter,
  FullTextIndex,
  paginate,
  sorting,
} from '~/core/neo4j/query';
import {
  type CreateTool,
  Tool,
  ToolFilters,
  type ToolListInput,
  type UpdateTool,
} from './dto';
import { type ToolKey } from './dto/tool-key.enum';

@Injectable()
export class ToolRepository extends DtoRepository(Tool) {
  async list(input: ToolListInput) {
    const query = this.db
      .query()
      .matchNode('node', 'Tool')
      .apply(toolFilters(input.filter))
      .apply(sorting(Tool, input))
      .apply(paginate(input, this.hydrate()));
    return (await query.first())!;
  }

  async create(input: CreateTool): Promise<UnsecuredDto<Tool>> {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'name',
        'Tool with this name already exists.',
      );
    }
    if (input.key !== undefined) {
      await this.assertKeyUnassigned(input.key);
    }

    const initialProps = {
      name: input.name,
      aiBased: input.aiBased,
      key: input.key,
    };
    if (input.key !== undefined) {
      initialProps.key = input.key;
    }
    const result = await this.db
      .query()
      .apply(await createNode(Tool, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new CreationFailed(Tool);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(Tool)
        : e;
    });
  }

  async update(changes: UpdateTool) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    return await this.readOne(id);
  }
  private async assertKeyUnassigned(key: ToolKey) {
    const result = await this.db
      .query()
      .match([
        node('tool', 'Tool'),
        relation('out', '', 'key'),
        node('prop', 'Property', { value: key }),
      ])
      .return<{ id: ID<'Tool'> }>('tool.id as id')
      .first();

    if (result) {
      throw new DuplicateException(
        'key',
        'Key is already assigned to another tool.',
      );
    }
  }

  async idByKey(key: ToolKey) {
    const result = await this.db
      .query()
      .match([
        node('tool', 'Tool'),
        relation('out', '', 'key'),
        node('prop', 'Property', { value: key }),
      ])
      .return<{ id: ID<'Tool'> }>('tool.id as id')
      .first();
    if (!result) {
      throw new NotFoundException('Tool not found', 'key');
    }
    return result.id;
  }

  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(ToolNameIndex.create()).run();
  }
}

export const toolFilters = filter.define(() => ToolFilters, {
  name: filter.fullText({
    index: () => ToolNameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Tool'),
        relation('out', '', 'name', ACTIVE),
        node('match'),
      ]),
    minScore: 0.8,
  }),
});

const ToolNameIndex = FullTextIndex({
  indexName: 'ToolName',
  labels: 'ToolName',
  properties: 'value',
  analyzer: 'standard-folding',
});
