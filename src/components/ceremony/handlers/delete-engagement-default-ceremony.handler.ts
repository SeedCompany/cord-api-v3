import { ConfigService } from '~/core/config';
import { OnHook } from '~/core/hooks';
import { EngagementWillDeleteHook } from '../../engagement/hooks';
import { CeremonyService } from '../ceremony.service';

@OnHook(EngagementWillDeleteHook)
export class DetachEngagementRootDirectoryHandler {
  constructor(
    private readonly ceremonies: CeremonyService,
    private readonly config: ConfigService,
  ) {}

  async handle({ engagement }: EngagementWillDeleteHook) {
    if (this.config.databaseEngine === 'gel') {
      return;
    }

    const ceremonyId = engagement.ceremony.value?.id;
    if (!ceremonyId) {
      return;
    }

    // TODO Ceremony should be changeset aware
    if (engagement.changeset) {
      return;
    }

    await this.ceremonies.delete(ceremonyId);
  }
}
