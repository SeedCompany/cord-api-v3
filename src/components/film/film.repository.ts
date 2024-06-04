import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import {
  DuplicateException,
  ID,
  PaginatedListType,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DbTypeOf, DtoRepository } from '~/core/database';
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
import { CreateFilm, Film, FilmListInput, UpdateFilm } from './dto';

@Injectable()
export class FilmRepository extends DtoRepository(Film) {
  constructor(
    private readonly scriptureRefsRepository: ScriptureReferenceRepository,
    private readonly scriptureRefsService: ScriptureReferenceService,
  ) {
    super();
  }

  async create(input: CreateFilm, session: Session) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'film.name',
        'Film with this name already exists',
      );
    }

    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    const result = await this.db
      .query()
      .apply(await createNode(Film, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new ServerException('failed to create a film');
    }

    await this.scriptureRefsService.create(
      result.id,
      input.scriptureReferences,
      session,
    );

    return await this.readOne(result.id);
  }

  async update(input: UpdateFilm) {
    const { id, name, scriptureReferences } = input;
    await this.updateProperties({ id }, { name });
    if (scriptureReferences !== undefined) {
      await this.scriptureRefsService.update(id, scriptureReferences);
    }
    return await this.readOne(input.id);
  }

  async readOne(id: ID) {
    return (await super.readOne(id)) as UnsecuredDto<Film>;
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<ReadonlyArray<UnsecuredDto<Film>>> {
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
  }: FilmListInput): Promise<PaginatedListType<UnsecuredDto<Film>>> {
    const result = await this.db
      .query()
      .matchNode('node', 'Film')
      .apply(sorting(Film, input))
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
        .return<{ dto: DbTypeOf<Film> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }
}
