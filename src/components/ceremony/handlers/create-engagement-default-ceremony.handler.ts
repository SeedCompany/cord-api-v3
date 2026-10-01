import { OnHook } from '~/core/hooks';
import { LanguageEngagement } from '../../engagement/dto';
import { EngagementCreatedHook } from '../../engagement/hooks';
import { CeremonyService } from '../ceremony.service';
import { CeremonyType } from '../dto';

@OnHook(EngagementCreatedHook)
export class CreateEngagementDefaultCeremonyHandler {
  constructor(private readonly ceremonies: CeremonyService) {}

  async handle(event: EngagementCreatedHook) {
    const { engagement } = event;
    const input = {
      type:
        LanguageEngagement.resolve(engagement) === LanguageEngagement
          ? CeremonyType.Dedication
          : CeremonyType.Certification,
    };

    // The FK on ceremonies.engagement_id carries the relationship.
    const ceremonyId = await this.ceremonies.create(input, engagement.id);
    event.engagement = {
      ...engagement,
      ceremony: { id: ceremonyId },
    };
  }
}
