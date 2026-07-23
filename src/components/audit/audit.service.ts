import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { ConfigService } from '~/core/config';
import {
  type ResourceMutationList,
  type ResourceMutationListInput,
} from './dto/resource-mutation.dto';
import { type ResourceMutatedHook } from './resource-mutated.hook';
import { ResourceMutationRepository } from './resource-mutation.repository';

const EMPTY: ResourceMutationList = { items: [], total: 0, hasMore: false };

@Injectable()
export class AuditService {
  constructor(
    private readonly repo: ResourceMutationRepository,
    private readonly identity: Identity,
    private readonly config: ConfigService,
  ) {}

  async record(hook: ResourceMutatedHook): Promise<void> {
    // The audit log lives in postgres; under neo4j the drizzle client has no
    // pool, so this is a no-op (no rows captured during the transition).
    // migration-todo(cutover-cleanup): drop this guard at Phase 7 cutover
    // (always postgres) — audit is postgres-only by design.
    if (this.config.databaseEngine !== 'postgres') {
      return;
    }
    // A no-op update (nothing actually changed) isn't worth an audit row.
    // Centralized here so every firing service is covered without each having
    // to guard its own empty-changes case. Creates/deletes always record —
    // they carry no change set by design.
    if (
      hook.action === 'Update' &&
      (hook.changes == null || Object.keys(hook.changes).length === 0)
    ) {
      return;
    }
    // Only a logged-in *user* is a valid actor. Anonymous sessions carry the
    // Anonymous SystemAgent's id (registration/bootstrap flows), which lives in
    // `system_agents`, not `users` — storing it would violate the actor FK.
    // migration-todo: ghost-impersonation sessions also carry a SystemAgent id;
    // revisit if/when the audit log needs to attribute those.
    const session = this.identity.currentMaybe;
    const actorId = session && !session.anonymous ? session.userId : null;
    // Snapshot the actor's roles AT WRITE TIME — the log is append-only, so a
    // missing value can never be backfilled. Stored as plain text (decoupled
    // from the live Role enum) so the historical record survives role changes.
    const roleAtTime = session ? [...session.roles] : [];

    await this.repo.record({
      resourceType: hook.resourceType,
      resourceId: hook.resourceId,
      action: hook.action,
      actorId,
      roleAtTime,
      changes: serializeChanges(hook.changes),
    });
  }

  async list(
    resourceType: string,
    resourceId: ID,
    input: ResourceMutationListInput,
  ): Promise<ResourceMutationList> {
    // migration-todo(cutover-cleanup): drop this guard at Phase 7 cutover
    // (always postgres).
    if (this.config.databaseEngine !== 'postgres') {
      return EMPTY;
    }
    return await this.repo.listByResource(resourceType, resourceId, input);
  }
}

/** Coerce a change set to plain JSON (luxon DateTimes -> ISO, drop undefined). */
const serializeChanges = (
  changes: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null =>
  changes == null
    ? null
    : (JSON.parse(JSON.stringify(changes)) as Record<string, unknown>);
