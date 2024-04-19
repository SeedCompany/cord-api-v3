import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session, UnsecuredDto } from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  matchPropsAndProjectSensAndScopedRoles,
  oncePerProject,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  Ceremony,
  CeremonyListInput,
  CreateCeremony,
  UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyRepository extends DtoRepository<
  typeof Ceremony,
  [session: Session]
>(Ceremony) {
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
      .apply(await createNode(Ceremony, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async update(
    existing: Ceremony,
    changes: ChangesOf<Ceremony, UpdateCeremony>,
  ) {
    return await this.updateProperties(existing, changes);
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .match([
          node('project', 'Project'),
          relation('out', '', 'engagement'),
          node('', 'Engagement'),
          relation('out', '', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .return<{ dto: UnsecuredDto<Ceremony> }>('props as dto');
  }

  async list({ filter, ...input }: CeremonyListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Ceremony'),
        relation('in', '', ACTIVE),
        node('', 'Engagement'),
        relation('in', '', 'engagement', ACTIVE),
        node('project', 'Project'),
        ...(filter.type
          ? [
              relation('out', '', 'type', ACTIVE),
              node('name', 'Property', { value: filter.type }),
            ]
          : []),
      ])
      .match(requestingUser(session))
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(
        sorting(Ceremony, input, {
          projectName: (query) =>
            query
              .match([
                node('project'),
                relation('out', '', 'name', ACTIVE),
                node('prop', 'Property'),
              ])
              .return<{ sortValue: string }>('prop.value as sortValue'),
        }),
      )
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
