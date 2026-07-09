import { ServerException } from '~/common';
import { ConfigService } from '~/core/config';
import { OnHook } from '~/core/hooks';
import { DatabaseService } from '~/core/neo4j';
import { EngagementStatus, IEngagement } from '../dto';
import { EngagementUpdatedHook } from '../hooks';

@OnHook(EngagementUpdatedHook)
export class SetLastStatusDate {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async handle(event: EngagementUpdatedHook) {
    const { previous, updated } = event;
    if (previous.status === updated.status) {
      return;
    }
    // migration-todo: drop this guard at Phase 7 cutover — under postgres the
    // drizzle repo's applyStatusChange stamps statusModifiedAt /
    // lastSuspendedAt / lastReactivatedAt in the same transaction, and the
    // updated DTO already carries them.
    if (this.config.databaseEngine === 'postgres') {
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
