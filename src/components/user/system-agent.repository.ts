import { Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { type Role } from '~/common';
import { DbTraceLayer } from '~/core/neo4j';
import { type SystemAgent } from './dto';

@Injectable()
export abstract class SystemAgentRepository {
  constructor() {
    DbTraceLayer.applyToInstance(this);
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

  protected abstract upsertAgent(
    name: string,
    roles?: readonly Role[],
  ): Promise<SystemAgent>;
}
