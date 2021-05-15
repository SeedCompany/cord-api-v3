import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Role } from '../authorization';
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
      .apply(matchRequestingUser(session))
      .match([node('node', 'Ceremony', { id })])
      .apply(matchPropList)
      .optionalMatch([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', { active: true }),
        node('node', 'Ceremony', { id }),
      ])
      .with(['node', 'propList', 'project'])
      .apply(matchMemberRoles(session.userId))
      .return(['node', 'propList', 'memberRoles'])
      .asResult<
        StandardReadResult<DbPropsOfDto<Ceremony>> & {
          memberRoles: Role[];
        }
      >();

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

  async getCeremonies(session: Session) {
    return await this.db
      .query()
      .match([matchSession(session), [node('ceremony', 'Ceremony')]])
      .return('ceremony.id as id')
      .run();
  }

  async hasProperties(session: Session, ceremony: Dictionary<any>) {
    return await this.db.hasProperties({
      session,
      id: ceremony.id,
      props: ['type'],
      nodevar: 'ceremony',
    });
  }
}
