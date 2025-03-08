import { Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { Role } from '~/common';
import { DbTraceLayer } from '~/core/database';
import { SystemAgent } from './dto';

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

  protected abstract upsertAgent(
    name: string,
    roles?: readonly Role[],
  ): Promise<SystemAgent>;
}
