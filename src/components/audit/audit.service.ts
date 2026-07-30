import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { Identity, type Session } from '~/core/authentication';
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
    const session = this.identity.currentMaybe;
    const { actorId, actorSystemAgent } = resolveActor(session);
    // The REAL requester behind an impersonated action. `identity.currentMaybe`
    // is the *effective* session, so without this an admin impersonating a user
    // would be recorded as that user — wrong data, silently. Always a user: an
    // impersonator's own session must have resolved to one for impersonation to
    // take effect at all (SessionManager.resumeSession), which is why this is a
    // plain FK to `users` while the actor needs two columns.
    const impersonatorId = session?.impersonator?.userId as
      | ID<'User'>
      | undefined;
    // Snapshot the actor's roles AT WRITE TIME — the log is append-only, so a
    // missing value can never be backfilled. Stored as plain text (decoupled
    // from the live Role enum) so the historical record survives role changes.
    // These are the EFFECTIVE roles, i.e. the ones the policy engine actually
    // evaluated, so they stay consistent with actorId under impersonation.
    const roleAtTime = session ? [...session.roles] : [];

    await this.repo.record({
      resourceType: hook.resourceType,
      resourceId: hook.resourceId,
      action: hook.action,
      actorId,
      actorSystemAgent,
      impersonatorId: impersonatorId ?? null,
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

/**
 * Split a session's identity across the two mutually-exclusive actor columns.
 *
 * `Session.userId` holds a User id *or* a SystemAgent id — anonymous sessions
 * carry the Anonymous agent's, ghost impersonation the Ghost agent's. Both live
 * in `system_agents`, not `users`, so storing either as `actor_id` violates the
 * actor FK and (because the audit write shares the mutation's transaction)
 * takes the whole mutation down with it. The agent is recorded by name instead.
 *
 * Falls back to a null actor rather than the agent name if a session somehow
 * reports anonymous without one, which is the pre-0027 behaviour and the safe
 * direction: attribution goes missing, nothing crashes.
 *
 * migration-todo: `SessionManager.asRole` builds a session with a literal
 * `'anonymous'` userId and `anonymous: false`, which is neither a user nor an
 * agent id — recording a mutation under it would violate the actor FK the same
 * way ghost impersonation did. Unreachable today (both call sites are read-only:
 * policy-dumper and permission.serializer), and the real fix belongs in
 * `asRole`, which contradicts its own docblock by dropping the current user.
 */
const resolveActor = (
  session: Session | undefined,
): { actorId: ID<'User'> | null; actorSystemAgent: string | null } => {
  if (!session) {
    return { actorId: null, actorSystemAgent: null };
  }
  if (session.anonymous || session.systemAgentName) {
    return { actorId: null, actorSystemAgent: session.systemAgentName ?? null };
  }
  return { actorId: session.userId as ID<'User'>, actorSystemAgent: null };
};

/** Coerce a change set to plain JSON (luxon DateTimes -> ISO, drop undefined). */
const serializeChanges = (
  changes: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null =>
  changes == null
    ? null
    : (JSON.parse(JSON.stringify(changes)) as Record<string, unknown>);
