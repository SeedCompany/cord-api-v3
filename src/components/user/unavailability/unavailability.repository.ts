import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../../core';
import { DbChanges } from '../../../core/database/changes';
import { matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  StandardReadResult,
} from '../../../core/database/results';
import {
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(session: Session, secureProps: Property[]) {
    const createUnavailability = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Unavailability', secureProps))
      .return('node.id as id')
      .asResult<{ id: ID }>();

    return await createUnavailability.first();
  }

  async connectUnavailability(id: ID, userId: ID) {
    const query = `
    MATCH (user: User {id: $userId}),
    (unavailability:Unavailability {id: $id})
    CREATE (user)-[:unavailability {active: true, createdAt: datetime()}]->(unavailability)
    RETURN  unavailability.id as id
    `;
    await this.db
      .query()
      .raw(query, {
        userId,
        id,
      })
      .run();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Unavailability', { id })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Unavailability>>>();

    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  async getUnavailability(session: Session, input: UpdateUnavailability) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User'),
        relation('out', '', 'unavailability', { active: true }),
        node('unavailability', 'Unavailability', { id: input.id }),
      ])
      .return('user')
      .first();
  }

  getActualChanges(
    unavailability: Unavailability,
    input: UpdateUnavailability
  ) {
    return this.db.getActualChanges(Unavailability, unavailability, input);
  }

  async updateProperties(
    unavailability: Unavailability,
    changes: DbChanges<Unavailability>
  ) {
    return await this.db.updateProperties({
      type: Unavailability,
      object: unavailability,
      changes,
    });
  }

  async deleteNode(node: Unavailability) {
    await this.db.deleteNode(node);
  }

  async list(
    { page, count, sort, order, filter }: UnavailabilityListInput,
    session: Session
  ) {
    return await this.db.list<Unavailability>({
      session,
      nodevar: 'unavailability',
      aclReadProp: 'canReadUnavailabilityList',
      aclEditProp: 'canCreateUnavailability',
      props: ['description', 'start', 'end'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
  }
}
