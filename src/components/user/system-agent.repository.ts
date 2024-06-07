import { Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { Role } from '~/common';
import { SystemAgent } from './dto';

@Injectable()
export abstract class SystemAgentRepository {
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
