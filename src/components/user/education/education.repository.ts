import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, Session } from '../../../common';
import { DtoRepository } from '../../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchRequestingUser,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../../core/database/query';
import { CreateEducation, Education, EducationListInput } from './dto';

@Injectable()
export class EducationRepository extends DtoRepository(Education) {
  async create(input: CreateEducation, session: Session) {
    const initialProps = {
      degree: input.degree,
      institution: input.institution,
      major: input.major,
    };

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Education, { initialProps }))
      .apply(
        createRelationships(Education, 'in', {
          education: ['User', input.userId],
        })
      )
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async getUserIdByEducation(id: ID) {
    return await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'education', ACTIVE),
        node('education', 'Education', { id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();
  }

  async list({ filter, ...input }: EducationListInput, session: Session) {
    const label = 'Education';

    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.userId
          ? [
              relation('in', '', 'education', ACTIVE),
              node('user', 'User', {
                id: filter.userId,
              }),
            ]
          : []),
      ])
      .apply(sorting(Education, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
