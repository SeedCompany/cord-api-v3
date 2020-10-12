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
    return new this.requestClass(this.db);
  }
}

export class RepositoryRequest {
  query: Query;
  constructor(protected readonly db: DatabaseService) {
    this.query = this.db.query();
    return this;
  }

  with(includes: any) {
    //this.query.raw('WITH *');
    for (const [key, value] of Object.entries(includes)) {
      this.query.raw('WITH $value AS ' + key, { value: value }); // TODO: this needs escaping to prevent injection attacks.
      //this.query.raw`WITH ${value} AS ` + key;
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

  async runQuery(expectedResponse: string[]) {
    this.query.return(expectedResponse.map((i) => 'stash.' + i + ' AS ' + i));
    const result = await this.query.first();

    if (!result) {
      throw new NotFoundException('could not find Engagement', 'engagement.id');
    }

    return result;
  }
}
