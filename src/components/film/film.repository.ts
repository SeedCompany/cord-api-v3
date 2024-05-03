import { Injectable } from '@nestjs/common';
import { node, Query } from 'cypher-query-builder';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session } from '../../common';
import { DbTypeOf, DtoRepository } from '../../core';
import {
  createNode,
  matchProps,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { ScriptureReferenceRepository } from '../scripture';
import { CreateFilm, Film, FilmListInput, UpdateFilm } from './dto';

@Injectable()
export class FilmRepository extends DtoRepository(Film) {
  constructor(private readonly scriptureRefs: ScriptureReferenceRepository) {
    super();
  }

  async create(input: CreateFilm) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(await createNode(Film, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async update(
    existing: Film,
    simpleChanges: Omit<ChangesOf<Film, UpdateFilm>, 'scriptureReferences'>,
  ) {
    await this.updateProperties(existing, simpleChanges);
  }

  async list({ filter, ...input }: FilmListInput, session: Session) {
    const result = await this.db
      .query()
      .match(requestingUser(session))
      .match(node('node', 'Film'))
      .apply(sorting(Film, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .subQuery('node', this.scriptureRefs.list())
        .return<{ dto: DbTypeOf<Film> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }
}
