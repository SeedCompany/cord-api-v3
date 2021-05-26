import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  StandardReadResult,
} from '../../../core/database/results';
import { Education, EducationListInput } from './dto';

@Injectable()
export class EducationRepository extends DtoRepository(Education) {
  async create(
    userId: ID,
    secureProps: Property[],
    createdAt: DateTime,
    session: Session
  ) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User', {
          id: userId,
        }),
      ])
      .apply(createBaseNode(await generateId(), 'Education', secureProps))
      .create([
        node('user'),
        relation('out', '', 'education', { active: true, createdAt }),
        node('node'),
      ])
      .return('node.id as id');

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Education', { id })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Education>>>();

    return await query.first();
  }

  async getUserEducation(session: Session, id: ID) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User'),
        relation('out', '', 'education', { active: true }),
        node('education', 'Education', { id }),
      ])
      .return('user')
      .first();
  }

  list({ filter, ...input }: EducationListInput, session: Session) {
    const label = 'Education';

    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.userId
          ? [
              relation('in', '', 'education', { active: true }),
              node('user', 'User', {
                id: filter.userId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Education, input));
  }
}
