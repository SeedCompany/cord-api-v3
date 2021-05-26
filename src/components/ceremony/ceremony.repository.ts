import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { ScopedRole } from '../authorization';
import { Ceremony, CeremonyListInput } from './dto';

@Injectable()
export class CeremonyRepository extends DtoRepository(Ceremony) {
  async create(session: Session, secureProps: Property[]) {
    return this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Ceremony', secureProps))
      .return('node.id as id');
  }

  async readOne(id: ID, session: Session) {
    const readCeremony = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', { active: true }),
        node('node', 'Ceremony', { id }),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return(['props', 'scopedRoles'])
      .asResult<{
        props: DbPropsOfDto<Ceremony, true>;
        scopedRoles: ScopedRole[];
      }>();

    return await readCeremony.first();
  }

  list({ filter, ...input }: CeremonyListInput, session: Session) {
    const label = 'Ceremony';
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.type
          ? [
              relation('out', '', 'type', { active: true }),
              node('name', 'Property', { value: filter.type }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Ceremony, input));
  }
}
