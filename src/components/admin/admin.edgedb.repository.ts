import { Injectable } from '@nestjs/common';
import { ID, Role } from '~/common';
import { RootUserAlias } from '~/core/config/root-user.config';
import { disableAccessPolicies, e, EdgeDB } from '~/core/edgedb';
import { AuthenticationRepository } from '../authentication/authentication.repository';
import { ActorRepository } from '../user/actor.repository';

@Injectable()
export class AdminEdgeDBRepository {
  private readonly db: EdgeDB;
  constructor(
    edgedb: EdgeDB,
    readonly auth: AuthenticationRepository,
    readonly actors: ActorRepository,
  ) {
    this.db = edgedb.withOptions(disableAccessPolicies);
  }

  async finishing(callback: () => Promise<void>) {
    await this.db.waitForConnection({
      forever: true,
      maxTimeout: { seconds: 10 },
    });
    await callback();
  }

  async doesRootUserExist() {
    const rootAlias = e.select(e.Alias, () => ({
      filter_single: { name: RootUserAlias },
    }));
    const rootUser = e.select(rootAlias.target.is(e.User), (u) => ({
      id: true,
      email: true,
      hash: u['<user[is Auth::Identity]'].passwordHash,
    }));
    const query = e.assert_single(rootUser);
    return await this.db.run(query);
  }

  async createRootUser(id: ID, email: string, passwordHash: string) {
    const ghost = await this.actors.getGhost();

    const newUser = e.insert(e.User, {
      id,
      email,
      realFirstName: 'Root',
      realLastName: 'Admin',
      roles: [Role.Administrator],
    });
    const query = e.insert(e.Alias, {
      name: RootUserAlias,
      target: newUser,
    });
    await this.db
      .withOptions((o) =>
        o
          // eslint-disable-next-line @typescript-eslint/naming-convention
          .withConfig({ allow_user_specified_id: true })
          .withGlobals({ currentActorId: ghost.id }),
      )
      .run(query);
    await this.auth.savePasswordHashOnUser(id, passwordHash);
  }

  async updateEmail(id: ID, email: string) {
    const ghost = await this.actors.getGhost();
    const u = e.cast(e.User, e.uuid(id));
    const query = e.update(u, () => ({ set: { email } }));
    await this.db
      .withOptions((o) =>
        o
          // eslint-disable-next-line @typescript-eslint/naming-convention
          .withConfig({ allow_user_specified_id: true })
          .withGlobals({ currentActorId: ghost.id }),
      )
      .run(query);
  }
}
