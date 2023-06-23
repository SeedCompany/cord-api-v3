import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Client, e } from '~/core/edgedb';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminEdgedbRepository extends AdminRepository {
  constructor(private readonly edgedb: Client) {
    super();
  }

  async finishing(callback: () => Promise<void>) {
    await this.edgedb.ensureConnected();
    await callback();
  }

  async checkExistingRoot() {
    const userQ = e.select(e.RootUser, (u) => ({
      id: true,
      email: true,
      hash: u['<user[is Auth::Identity]'].passwordHash,
    }));
    const query = e.assert_exists(e.assert_single(userQ));
    const user = await query.run(this.edgedb);
    return {
      id: user.id,
      email: user.email ?? '',
      hash: user.hash ?? '',
    };
  }

  async mergeRootAdminUser(_email: string, hashedPassword: string) {
    // email is currently static for RootUser, so don't change.
    const query = e.params({ hash: e.str }, ({ hash }) =>
      e.update(e.Auth.Identity, (identity) => ({
        filter: e.op(identity.user, '=', e.RootUser),
        set: { passwordHash: hash },
      })),
    );
    await query.run(this.edgedb, { hash: hashedPassword });
  }

  async checkDefaultOrg() {
    return true;
  }

  async mergeAnonUser(_createdAt: DateTime, _anonUserId: string) {
    // nah
  }
}
