import { Injectable } from '@nestjs/common';
import { Node, node, regexp, Relation, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';

import {
  CalendarDate,
  generateId,
  ID,
  Sensitivity,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  property,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  collect,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  BaseNode,
  PropListDbResult,
  StandardReadResult,
} from '../../core/database/results';
import { SearchInput, SearchResultMap } from './dto';

@Injectable()
export class SearchRepository {
  constructor(private readonly db: DatabaseService) {}

  async search(
    input: SearchInput,
    session: Session,
    typeFromLabels: string,
    types: string[]
  ) {
    // Search for nodes based on input, only returning their id and "type"
    // which is based on their first valid search label.
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(matchUserPermissions)
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('property', 'Property'),
      ])
      // reduce to nodes with a label of one of the specified types
      .raw('WHERE size([l in labels(node) where l in $types | 1]) > 0', {
        types,
      })
      .with(['node', 'property'])
      .where({
        property: { value: regexp(`.*${input.query}.*`, true) },
      })
      .returnDistinct(['node.id as id', typeFromLabels])
      .limit(input.count)
      .asResult<{ id: ID; type: keyof SearchResultMap }>();

    return await query.run();
  }
}
