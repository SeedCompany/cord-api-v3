import { ServerException } from '~/common';
import { DatabaseService } from '~/core/database';
import { OnHook } from '~/core/hooks';
import { EngagementStatus, IEngagement } from '../dto';
import { EngagementUpdatedHook } from '../hooks';

@OnHook(EngagementUpdatedHook)
export class SetLastStatusDate {
  constructor(private readonly db: DatabaseService) {}

  async handle(event: EngagementUpdatedHook) {
    const { previous, updated } = event;
    if (previous.status === updated.status) {
      return;
    }

    try {
      const modifiedAt = updated.modifiedAt;
      const changes = {
        statusModifiedAt: modifiedAt,
        ...(updated.status === EngagementStatus.Suspended
          ? {
              lastSuspendedAt: modifiedAt,
            }
          : {}),
        ...(previous.status === EngagementStatus.Suspended &&
        updated.status === EngagementStatus.Active
          ? {
              lastReactivatedAt: modifiedAt,
            }
          : {}),
      } as const;

      event.updated = await this.db.updateProperties({
        type: IEngagement.resolve(updated),
        object: updated,
        changes,
      });
    } catch (exception) {
      throw new ServerException('Could not set last status date', exception);
    }
  }
}
