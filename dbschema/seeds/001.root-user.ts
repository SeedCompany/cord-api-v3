import { EnvironmentService } from '~/core/config/environment.service';
import { determineRootUser } from '~/core/config/root-user.config';
import type { SeedFn } from '~/core/edgedb/seeds.run';

export default (async function ({ e, db, print }) {
  const env = new EnvironmentService();
  const rootUser = determineRootUser(env);

  try {
    await e.cast(e.User, e.uuid(rootUser.id)).run(db);
    return;
  } catch {
    // doesn't exist, create below
  }

  const query = e.insert(e.User, {
    id: rootUser.id,
    email: rootUser.email,
    realFirstName: 'Root',
    realLastName: 'Admin',
    roles: ['Administrator'],
    createdAt: e.datetime('2021-02-13T15:29:18.603Z'),
    modifiedAt: e.datetime('2021-02-13T15:29:18.603Z'),
  });
  await query.run(db);
  print('Added Root User');
} satisfies SeedFn);
