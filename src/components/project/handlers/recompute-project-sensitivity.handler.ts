import { Injectable } from '@nestjs/common';
import { ConfigService } from '~/core/config';
import { type ILogger, Logger } from '~/core/logger';

/**
 * Recompute the denormalized `projects.sensitivity` from the parent
 * Engagement/Language sensitivity max.
 *
 * migration-todo (Tier 2 Language migration wires the real hook):
 *   - subscribe to `LanguageSensitivityUpdatedHook`, `EngagementCreatedHook`,
 *     `EngagementDeletedHook`, and the LanguageEngagement attach/detach
 *     events (whichever land first when Language ports);
 *   - run `UPDATE projects SET sensitivity = (max over engagement→language)`
 *     within the same transaction so writes are atomic.
 *
 * In the meantime Translation projects read `'High'` under DATABASE=postgres
 * (set by the column default + projects.create()). This is acceptable because
 * postgres mode is dev-only until cutover, and the canonical Neo4j
 * sensitivity flows back in via the one-time migration script. Internship
 * projects are unaffected — they read `own_sensitivity` (set by repo.create
 * directly).
 *
 * The class exists now so it can be wired into ProjectModule's providers and
 * keep the import graph stable; converting from no-op to real handler in the
 * Language PR is a one-file change.
 */
@Injectable()
export class RecomputeProjectSensitivityHandler {
  constructor(
    private readonly config: ConfigService,
    @Logger('project:sensitivity-recompute')
    private readonly logger: ILogger,
  ) {}

  // migration-todo: when Language migrates, replace this no-op with the real
  // handler. Until then we only log under postgres so devs notice the gap.
  recompute(projectId: string): void {
    if (this.config.databaseEngine === 'postgres') {
      this.logger.debug(
        `Sensitivity recompute deferred for project ${projectId} — pending Language migration (Tier 2)`,
      );
    }
  }
}
