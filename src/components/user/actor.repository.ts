import { Injectable } from '@nestjs/common';
import { CachedByArg } from '@seedcompany/common';
import { ID, Role } from '~/common';

@Injectable()
export abstract class ActorRepository {
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
  ): Promise<{ id: ID; name: string; roles: readonly Role[] }>;
}
