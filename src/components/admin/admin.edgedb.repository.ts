import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { e, EdgeDB } from '~/core/edgedb';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminEdgeDBRepository extends AdminRepository {
  constructor(private readonly edgedb: EdgeDB) {
    super();
  }

  async finishing(callback: () => Promise<void>) {
    await this.edgedb.waitForConnection({
      forever: true,
      maxTimeout: { seconds: 10 },
    });
    await callback();
  }

  async checkExistingRoot() {
    const rootUser = e.select(e.RootUser, (u) => ({
      id: true,
      email: true,
      hash: u['<user[is Auth::Identity]'].passwordHash,
    }));
    const query = e.assert_exists(e.assert_single(rootUser));
    const user = await this.edgedb.run(query);
    return {
      id: user.id,
      email: user.email ?? '',
      hash: user.hash ?? '',
    };
  }

  async mergeRootAdminUser(_email: string, passwordHash: string) {
    // email is currently static for RootUser, so don't change.
    const query = e
      .insert(e.Auth.Identity, {
        user: e.select(e.RootUser).assert_single(),
        passwordHash,
      })
      .unlessConflict((identity) => ({
        on: identity.user,
        else: e.update(e.Auth.Identity, () => ({
          filter: e.op(identity.user, '=', e.RootUser),
          set: { passwordHash },
        })),
      }));
    await this.edgedb.run(query);
  }

  async checkDefaultOrg() {
    return true;
  }

  async mergeAnonUser(_createdAt: DateTime, _anonUserId: string) {
    // nah
  }
}
