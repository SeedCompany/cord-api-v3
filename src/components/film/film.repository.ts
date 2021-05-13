import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Film, FilmListInput, UpdateFilm } from './dto';

@Injectable()
export class FilmRepository {
  constructor(private readonly db: DatabaseService) {}

  async checkFilm(name: string) {
    return await this.db
      .query()
      .match([node('film', 'FilmName', { value: name })])
      .return('film')
      .first();
  }

  async createFilm(name: string, session: Session) {
    const secureProps = [
      {
        key: 'name',
        value: name,
        isPublic: true,
        isOrgPublic: true,
        label: 'FilmName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(await generateId(), ['Film', 'Producible'], secureProps)
      )
      .return('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const readFilm = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Film', { id })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Film>>>();

    return await readFilm.first();
  }
  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(film: Film, input: UpdateFilm) {
    return this.db.getActualChanges(Film, film, input);
  }

  async updateProperties(
    object: Film,
    changes: {
      name?: string | undefined;
    }
  ) {
    await this.db.updateProperties({
      type: Film,
      object,
      changes,
    });
  }

  async deleteNode(node: Film) {
    return void (await this.db.deleteNode(node));
  }

  list({ filter, ...input }: FilmListInput, session: Session) {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Film')])
      .apply(calculateTotalAndPaginateList(Film, input));
  }
}
