import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Direction } from 'cypher-query-builder/dist/typings/clauses/order-by';
import { DatabaseService } from '.';
import { NotFoundException } from '../../common';

@Injectable()
export class Repository {
  constructor(protected readonly db: DatabaseService) {}
  requestClass = RepositoryRequest;

  request() {
    const request = new this.requestClass(this.db);
    request.query.raw('WITH {} AS stash');
    return request;
  }
}

export class RepositoryRequest {
  query: Query;
  constructor(protected readonly db: DatabaseService) {
    this.query = this.db.query();
    return this;
  }

  with(includes: any) {
    for (const [key, value] of Object.entries(includes)) {
      this.query.raw('WITH apoc.map.setKey(stash, $key, $value) AS stash', {
        key: key,
        value: value,
      });
    }

    return this;
  }

  calculateTotalAndPaginateList(
    sort: string,
    order: Direction,
    page: number,
    count: number,
    isSortOnNode: boolean
  ) {
    this.query
      .with([
        'collect(distinct node) as nodes',
        'count(distinct node) as total',
      ])
      .raw(`unwind nodes as node`);

    if (isSortOnNode) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.query.with('*').orderBy(`node.${sort}`, order);
    } else {
      this.query
        .match([
          node('node'),
          relation('out', '', sort),
          node('prop', 'Property'),
        ])
        .with('*')
        .orderBy('prop.value', order);
    }

    this.query.with([
      `collect(distinct node.id)[${(page - 1) * count}..${
        page * count
      }] as items`,
      'total',
    ]);

    return this;
  }

  getSecuredPropertiesMap(userId: string, securedNodeId: string | null) {
    // If called with securedNodeId null,
    // then it expects "securedNodeId" to be in scope in cypher
    if (securedNodeId != null) {
      this.query.raw(
        `
          WITH $securedNodeId AS securedNodeId, stash
        `,
        { securedNodeId: securedNodeId }
      );
    }
    this.query.raw(
      `
        WITH $userId AS requestingUserId, securedNodeId, stash

        MATCH (requestingUser:User { id: requestingUserId })
        MATCH (securedNode {id: securedNodeId})
        OPTIONAL MATCH (requestingUser)<-[:member]-(:SecurityGroup)-[:permission]->(permissionNode:Permission)-[:baseNode]->(securedNode)
        WITH requestingUser, permissionNode, securedNode, stash
        
        MATCH (permissionNode)-[:baseNode]-(securedNode)-[securedPropertyRelationship {active: true}]-(securedProperty:Property) WHERE type(securedPropertyRelationship) = permissionNode.property
        WITH [type(securedPropertyRelationship),  [securedProperty.value, permissionNode.read, permissionNode.edit]] AS securedCollection, stash
        WITH [securedCollection[0], {value: [n in COLLECT(securedCollection) | n[1][0]][0], canRead: true in [n in COLLECT(securedCollection) | n[1][1]], canEdit: true in [n in COLLECT(securedCollection) | n[1][2]]}] AS mergedPairs, stash
        WITH apoc.map.fromPairs(COLLECT(mergedPairs)) AS securedPropertiesMap, stash
        WITH apoc.map.setKey(stash, 'securedPropertiesMap', securedPropertiesMap) AS stash
    `,
      { userId: userId }
    );
    return this;
  }

  async runQuery(expectedResponse: string[]) {
    this.query.return(expectedResponse.map((i) => 'stash.' + i + ' AS ' + i));
    const result = await this.query.first();

    if (!result) {
      throw new NotFoundException('could not find Engagement', 'engagement.id');
    }

    return result;
  }
}
