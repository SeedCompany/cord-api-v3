import { Injectable } from '@nestjs/common';
import { Role } from '~/common';
import { disableAccessPolicies, EdgeDB, edgeql } from '~/core/edgedb';
import { ActorRepository } from './actor.repository';

@Injectable()
export class ActorEdgeDBRepository extends ActorRepository {
  private readonly db: EdgeDB;
  constructor(edgedb: EdgeDB) {
    super();
    this.db = edgedb.withOptions(disableAccessPolicies);
  }

  protected async upsertAgent(name: string, roles?: readonly Role[]) {
    const query = edgeql(`
      select (
        (select SystemAgent filter .name = <str>$name) ??
        (insert SystemAgent {
          name := <str>$name,
          roles := array_unpack(<optional array<Role>>$roles)
        })
      ) {*}
    `);
    return await this.db.run(query, { name, roles });
  }
}
