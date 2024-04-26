import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { ServerException, Session, UnsecuredDto } from '../../common';
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
  async create(input: CreateCeremony) {
    const initialProps = {
      type: input.type,
      planned: input.planned,
      estimatedDate: input.estimatedDate,
      actualDate: input.actualDate,
      canDelete: true,
    };
    const result = await this.db
      .query()
      .apply(await createNode(Ceremony, { initialProps }))
      .return<{ node: UnsecuredDto<Ceremony> }>('node')
      .first();

    if (!result) {
      throw new ServerException('failed to create a ceremony');
    }
    return result;
  }

  async update(changes: UpdateCeremony) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    // I don't understand why something like funding-account does not require args but this one does?
    // I also don't feel like I know what args or where they should come from so feel stuck
    return await this.readOne(id);
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
