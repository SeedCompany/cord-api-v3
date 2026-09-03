import { OnHook } from '~/core/hooks';
import { UserDeletedHook } from '../../../components/user/hooks/user-deleted.hook';
import { AuthenticationService } from '../authentication.service';

/**
 * Soft-deleting a user revokes all their sessions. Neo4j got this only
 * incidentally (the delete relabels the User node, so session→user matches
 * fail and the session degrades to anonymous); under Postgres the sessions
 * would otherwise stay live indefinitely. Runs inside the delete's
 * transaction, so a rollback also rolls back the revocation.
 */
@OnHook(UserDeletedHook)
export class DeletedUserLogsThemOutHandler {
  constructor(private readonly auth: AuthenticationService) {}
  async handle({ id }: UserDeletedHook) {
    await this.auth.logoutByUser(id);
  }
}
