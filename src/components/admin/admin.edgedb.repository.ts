import { Injectable } from '@nestjs/common';
import { ID, Role } from '~/common';
import { disableAccessPolicies, e, EdgeDB } from '~/core/edgedb';
import { AuthenticationRepository } from '../authentication/authentication.repository';

@Injectable()
export class AdminEdgeDBRepository {
  private readonly db: EdgeDB;
  constructor(edgedb: EdgeDB, readonly auth: AuthenticationRepository) {
    this.db = edgedb.withOptions(disableAccessPolicies);
  }

  async finishing(callback: () => Promise<void>) {
    await this.db.waitForConnection({
      forever: true,
      maxTimeout: { seconds: 10 },
    });
    await callback();
  }

  async doesRootUserExist(rootId: ID) {
    const rootUser = e.select(e.User, (u) => ({
      id: true,
      email: true,
      hash: u['<user[is Auth::Identity]'].passwordHash,
      filter_single: { id: rootId },
    }));
    const query = e.assert_single(rootUser);
    return await this.db.run(query);
  }

  async createRootUser(id: ID, email: string, passwordHash: string) {
    const query = e.insert(e.User, {
      id,
      email,
      realFirstName: 'Root',
      realLastName: 'Admin',
      roles: [Role.Administrator],
    });
    await this.db
      // eslint-disable-next-line @typescript-eslint/naming-convention
      .withOptions((o) => o.withConfig({ allow_user_specified_id: true }))
      .run(query);
    await this.auth.savePasswordHashOnUser(id, passwordHash);
  }

  async updateEmail(id: ID, email: string) {
    const u = e.cast(e.User, e.uuid(id));
    const query = e.update(u, () => ({ set: { email } }));
    await this.db.run(query);
  }
}
