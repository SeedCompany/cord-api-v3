import { Injectable } from '@nestjs/common';
import { Connection, Query } from 'cypher-query-builder';
import { Driver } from 'neo4j-driver/types/v1';
import { Dictionary } from 'lodash';
import { Observable } from 'rxjs';

/**
 * Probably can deprecate this and just use Connection instead.
 */
@Injectable()
export class DatabaseService {
  constructor(private readonly db: Connection) {}

  /**
   * @deprecated Use query() or run() instead.
   */
  get driver(): Driver {
    return (this.db as any).driver;
  }

  query(): Query {
    return this.db.query();
  }

  run<R = any>(query: Query): Promise<Array<Dictionary<R>>> {
    return this.db.run<R>(query);
  }

  session() {
    return this.db.session();
  }

  stream<R = any>(query: Query): Observable<Dictionary<R>> {
    return this.db.stream<R>(query);
  }
}
