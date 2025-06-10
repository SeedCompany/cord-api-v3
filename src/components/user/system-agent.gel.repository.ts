import { Injectable } from '@nestjs/common';
import { type Role } from '~/common';
import { disableAccessPolicies, e, Gel } from '~/core/gel';
import { SystemAgentRepository } from './system-agent.repository';

@Injectable()
export class SystemAgentGelRepository extends SystemAgentRepository {
  private readonly db: Gel;
  constructor(db: Gel) {
    super();
    this.db = db.outsideOfTransactions().withOptions(disableAccessPolicies);
  }

  protected async upsertAgent(name: string, roles?: readonly Role[]) {
    const upserted = e.op(
      e.select(e.SystemAgent, () => ({ filter_single: { name } })),
      '??',
      e.insert(e.SystemAgent, { name, roles }),
    );
    const query = e.select(upserted, (agent) => ({
      __typename: e.str('SystemAgent' as const),
      ...agent['*'],
    }));
    return await this.db.run(query);
  }
}
