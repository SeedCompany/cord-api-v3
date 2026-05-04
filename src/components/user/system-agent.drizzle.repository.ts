import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { generateId, type Role } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { systemAgents } from '~/core/drizzle/schema';
import { type SystemAgent } from './dto';
import { SystemAgentRepository } from './system-agent.repository';

@Injectable()
export class SystemAgentDrizzleRepository extends SystemAgentRepository {
  constructor(private readonly db: DrizzleService) {
    super();
  }

  protected async upsertAgent(
    name: string,
    roles?: readonly Role[],
  ): Promise<SystemAgent> {
    const id = await generateId();
    const [row] = await this.db.db
      .insert(systemAgents)
      .values({ id, name, roles: [...(roles ?? [])] })
      .onConflictDoUpdate({
        target: systemAgents.name,
        set: { roles: [...(roles ?? [])] },
      })
      .returning();

    return this.toAgent(row!);
  }

  private toAgent(row: typeof systemAgents.$inferSelect): SystemAgent {
    // migration-todo: SystemAgent is abstract; cast bridges plain row → class shape
    return {
      id: row.id,
      __typename: 'SystemAgent',
      name: row.name,
      roles: row.roles as Role[],
      createdAt: DateTime.fromJSDate(row.createdAt),
    } as unknown as SystemAgent;
  }
}
