import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session } from '../../../common';
import { DtoRepository } from '../../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchRequestingUser,
  paginate,
  sorting,
} from '../../../core/database/query';
import {
  CreateEducation,
  Education,
  EducationListInput,
  UpdateEducation,
} from './dto';

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
        }),
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

  async update(
    existing: Education,
    changes: ChangesOf<Education, UpdateEducation>,
  ) {
    await this.updateProperties(existing, changes);
  }

  async list({ filter, ...input }: EducationListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'Education')
      .match([
        ...(filter.userId
          ? [
              node('node'),
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
