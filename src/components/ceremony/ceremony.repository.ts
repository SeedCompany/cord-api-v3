import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { CreationFailed, type ID, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  matchPropsAndProjectSensAndScopedRoles,
  oncePerProject,
  paginate,
  sorting,
} from '~/core/database/query';
import {
  Ceremony,
  type CeremonyListInput,
  type CreateCeremony,
  type UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyRepository extends DtoRepository(Ceremony) {
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
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new CreationFailed(Ceremony);
    }
    return result;
  }

  async update(changes: UpdateCeremony) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    return await this.readOne(id);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('project', 'Project'),
          relation('out', '', 'engagement'),
          node('', 'Engagement'),
          relation('out', '', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles())
        .return<{ dto: UnsecuredDto<Ceremony> }>('props as dto');
  }

  async list({ filter, ...input }: CeremonyListInput) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Ceremony'),
        relation('in', '', ACTIVE),
        node('', 'Engagement'),
        relation('in', '', 'engagement', ACTIVE),
        node('project', 'Project'),
        ...(filter?.type
          ? [
              relation('out', '', 'type', ACTIVE),
              node('name', 'Property', { value: filter.type }),
            ]
          : []),
      ])
      .apply(
        this.privileges.filterToReadable({
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
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
