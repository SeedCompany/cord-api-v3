import { Injectable } from '@nestjs/common';
import { node, Query } from 'cypher-query-builder';
import { ID, Session, UnsecuredDto } from '../../common';
import { DatabaseService, DtoRepository } from '../../core';
import {
  createNode,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { ScriptureReferenceRepository } from '../scripture';
import { CreateFilm, Film, FilmListInput } from './dto';

@Injectable()
export class FilmRepository extends DtoRepository(Film) {
  constructor(
    private readonly scriptureRefs: ScriptureReferenceRepository,
    db: DatabaseService
  ) {
    super(db);
  }

  async createFilm(input: CreateFilm, session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Film, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
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
        .return<{ dto: UnsecuredDto<Film> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto')
        );
  }
}
