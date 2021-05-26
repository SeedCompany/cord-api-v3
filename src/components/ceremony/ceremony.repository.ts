import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { ScopedRole } from '../authorization';
import { Ceremony, CeremonyListInput, UpdateCeremony } from './dto';

@Injectable()
export class CeremonyRepository {
  constructor(private readonly db: DatabaseService) {}

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

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(object: Ceremony, input: UpdateCeremony) {
    return this.db.getActualChanges(Ceremony, object, input);
  }

  async updateProperties(object: Ceremony, changes: DbChanges<Ceremony>) {
    return await this.db.updateProperties({
      type: Ceremony,
      object,
      changes,
    });
  }

  async deleteNode(node: Ceremony) {
    await this.db.deleteNode(node);
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
