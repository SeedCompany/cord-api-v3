import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Film, FilmListInput } from './dto';

@Injectable()
export class FilmRepository extends DtoRepository(Film) {
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

  list({ filter, ...input }: FilmListInput, session: Session) {
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Film')])
      .apply(calculateTotalAndPaginateList(Film, input));
  }
}
