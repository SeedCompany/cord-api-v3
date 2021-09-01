import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session, UnsecuredDto } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  ACTIVE,
  createNode,
  matchPropsAndProjectSensAndScopedRoles,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { Ceremony, CeremonyListInput, CreateCeremony } from './dto';

@Injectable()
export class CeremonyRepository extends DtoRepository(Ceremony) {
  async create(input: CreateCeremony, session: Session) {
    const initialProps = {
      type: input.type,
      planned: input.planned,
      estimatedDate: input.estimatedDate,
      actualDate: input.actualDate,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Ceremony, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', ACTIVE),
        node('', 'Engagement'),
        relation('out', '', ACTIVE),
        node('node', 'Ceremony', { id }),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return<{ dto: UnsecuredDto<Ceremony> }>('props as dto');

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    return result.dto;
  }

  async list({ filter, ...input }: CeremonyListInput, session: Session) {
    const label = 'Ceremony';
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.type
          ? [
              relation('out', '', 'type', ACTIVE),
              node('name', 'Property', { value: filter.type }),
            ]
          : []),
      ])
      .apply(sorting(Ceremony, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
