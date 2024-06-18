import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException, ServerException } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  paginate,
  sorting,
} from '~/core/database/query';
import {
  CreateEducation,
  Education,
  EducationListInput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationRepository extends DtoRepository(Education) {
  async create(input: CreateEducation) {
    const initialProps = {
      degree: input.degree,
      institution: input.institution,
      major: input.major,
    };

    const query = this.db
      .query()
      .apply(await createNode(Education, { initialProps }))
      .apply(
        createRelationships(Education, 'in', {
          education: ['User', input.userId],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create education');
    }
    return await this.readOne(result.id);
  }

  async getUserIdByEducation(id: ID) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User'),
        relation('out', '', 'education', ACTIVE),
        node('education', 'Education', { id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();

    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with education',
        'user.education',
      );
    }
    return result;
  }

  async update(changes: UpdateEducation) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    return await this.readOne(id);
  }

  async list({ filter, ...input }: EducationListInput) {
    const result = await this.db
      .query()
      .matchNode('node', 'Education')
      .match([
        ...(filter?.userId
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
