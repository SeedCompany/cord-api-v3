import { Injectable } from '@nestjs/common';
import { type Query } from 'cypher-query-builder';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  NotFoundException,
  type PaginatedListType,
  ReadAfterCreationFailed,
  type UnsecuredDto,
} from '~/common';
import { type DbTypeOf, DtoRepository } from '~/core/database';
import {
  createNode,
  matchProps,
  merge,
  paginate,
  sorting,
} from '~/core/database/query';
import {
  ScriptureReferenceRepository,
  ScriptureReferenceService,
} from '../scripture';
import {
  type CreateStory,
  Story,
  type StoryListInput,
  type UpdateStory,
} from './dto';

@Injectable()
export class StoryRepository extends DtoRepository(Story) {
  constructor(
    private readonly scriptureRefsRepository: ScriptureReferenceRepository,
    private readonly scriptureRefsService: ScriptureReferenceService,
  ) {
    super();
  }

  async create(input: CreateStory) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'story.name',
        'Story with this name already exists.',
      );
    }

    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    const result = await this.db
      .query()
      .apply(await createNode(Story, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new CreationFailed(Story);
    }

    await this.scriptureRefsService.create(
      result.id,
      input.scriptureReferences,
    );

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(Story)
        : e;
    });
  }

  async update(input: UpdateStory) {
    const { id, name, scriptureReferences } = input;
    await this.updateProperties({ id }, { name });
    if (scriptureReferences !== undefined) {
      await this.scriptureRefsService.update(id, scriptureReferences);
    }
    return await this.readOne(input.id);
  }

  async readOne(id: ID) {
    return (await super.readOne(id)) as UnsecuredDto<Story>;
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<ReadonlyArray<UnsecuredDto<Story>>> {
    const items = await super.readMany(ids);
    return items.map((r) => ({
      ...r,
      scriptureReferences: this.scriptureRefsService.parseList(
        r.scriptureReferences,
      ),
    }));
  }

  async list({
    filter,
    ...input
  }: StoryListInput): Promise<PaginatedListType<UnsecuredDto<Story>>> {
    const result = await this.db
      .query()
      .matchNode('node', 'Story')
      .apply(sorting(Story, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return {
      ...result!,
      items: result!.items.map((r) => ({
        ...r,
        scriptureReferences: this.scriptureRefsService.parseList(
          r.scriptureReferences,
        ),
      })),
    };
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .subQuery('node', this.scriptureRefsRepository.list())
        .return<{ dto: DbTypeOf<Story> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }
}
