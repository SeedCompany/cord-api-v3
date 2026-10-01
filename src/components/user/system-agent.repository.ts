import { Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { DateTime } from 'luxon';
import { generateId, type Role, TraceLayer } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { systemAgents } from '~/core/drizzle/schema';
import { type SystemAgent } from './dto';

@Injectable()
export class SystemAgentRepository {
  constructor(private readonly drizzle: DrizzleService) {
    TraceLayer.as('db').applyToInstance(this);
  }

  @CachedByArg()
  async getAnonymous() {
    return await this.upsertAgent('Anonymous');
  }

  @CachedByArg()
  async getGhost() {
    return await this.upsertAgent('Ghost');
  }

  @CachedByArg()
  async getExternalMailingGroup() {
    return await this.upsertAgent('External Mailing Group', ['Leadership']);
  }

  /**
   * Deliberately NOT `@CachedByArg` like its siblings: the first call happens
   * inside an ingest mutation's transaction, and a process-wide cache of a row
   * that transaction may roll back would leave every later caller referencing
   * a phantom agent id until restart. The upsert is one cheap query per
   * auto-advance.
   */
  async getRev79() {
    return await this.upsertAgent('Rev79', ['Administrator']);
  }

  protected async upsertAgent(
    name: string,
    roles?: readonly Role[],
  ): Promise<SystemAgent> {
    const id = await generateId();
    const [row] = await this.drizzle.client
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
    // SystemAgent is abstract; the cast bridges the plain row to the class shape.
    return {
      id: row.id,
      __typename: 'SystemAgent',
      name: row.name,
      roles: row.roles,
      createdAt: DateTime.fromJSDate(row.createdAt),
    } as unknown as SystemAgent;
  }
}
