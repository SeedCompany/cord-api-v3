import { Injectable } from '@nestjs/common';
import { Role } from '~/common';
import { disableAccessPolicies, edgeql, Gel } from '~/core/gel';
import { SystemAgentRepository } from './system-agent.repository';

@Injectable()
export class SystemAgentGelRepository extends SystemAgentRepository {
  private readonly db: Gel;
  constructor(db: Gel) {
    super();
    this.db = db.outsideOfTransactions().withOptions(disableAccessPolicies);
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
