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
  type CreateEthnoArt,
  EthnoArt,
  type EthnoArtListInput,
  type UpdateEthnoArt,
} from './dto';

@Injectable()
export class EthnoArtRepository extends DtoRepository(EthnoArt) {
  constructor(
    private readonly scriptureRefsRepository: ScriptureReferenceRepository,
    private readonly scriptureRefsService: ScriptureReferenceService,
  ) {
    super();
  }

  async create(input: CreateEthnoArt) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'ethnoArt.name',
        'Ethno art with this name already exists',
      );
    }

    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    const result = await this.db
      .query()
      .apply(await createNode(EthnoArt, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new CreationFailed(EthnoArt);
    }

    await this.scriptureRefsService.create(
      result.id,
      input.scriptureReferences,
    );

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(EthnoArt)
        : e;
    });
  }

  async update(input: UpdateEthnoArt) {
    const { id, name, scriptureReferences } = input;
    await this.updateProperties({ id }, { name });
    if (scriptureReferences !== undefined) {
      await this.scriptureRefsService.update(id, scriptureReferences);
    }
    return await this.readOne(input.id);
  }

  async readOne(id: ID) {
    return (await super.readOne(id)) as UnsecuredDto<EthnoArt>;
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<ReadonlyArray<UnsecuredDto<EthnoArt>>> {
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
  }: EthnoArtListInput): Promise<PaginatedListType<UnsecuredDto<EthnoArt>>> {
    const result = await this.db
      .query()
      .matchNode('node', 'EthnoArt')
      .apply(sorting(EthnoArt, input))
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
        .return<{ dto: DbTypeOf<EthnoArt> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }
}
