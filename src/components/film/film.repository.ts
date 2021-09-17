import { Injectable } from '@nestjs/common';
import { inArray, node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  createNode,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateFilm, Film, FilmListInput } from './dto';

@Injectable()
export class FilmRepository extends DtoRepository(Film) {
  async checkFilm(name: string) {
    return await this.db
      .query()
      .match([node('film', 'FilmName', { value: name })])
      .return('film')
      .first();
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

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Film', { id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find film', 'film.id');
    }
    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('node', 'Film')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async list({ filter, ...input }: FilmListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Film')])
      .apply(sorting(Film, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
