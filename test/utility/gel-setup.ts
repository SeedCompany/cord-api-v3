import { Client, ConnectOptions, createClient } from 'gel';
import { DateTime } from 'luxon';

export const ephemeralGel = async () => {
  if (process.env.DATABASE !== 'gel') {
    return undefined;
  }

  const db = createClient();
  const config = await db.resolveConnectionParams();
  // Workaround old default fallback. Didn't hit locally, but did in CI.
  const main = config.branch === 'edgedb' ? 'main' : config.branch;

  await dropStale(db);

  const branch = `test_${Date.now()}_${String(Math.random()).slice(2)}`;

  await db.execute(`create schema branch ${branch} from ${main}`);

  const cleanup = async () => {
    await db.execute(`drop branch ${branch} force`);
    await db.close();
  };

  const options: ConnectOptions = { branch };

  return { options, cleanup };
};

async function dropStale(db: Client) {
  const branches = await db.query<string>('select sys::Database.name');

  const stale = branches.filter((name) => {
    if (!name.startsWith('test_')) {
      return false;
    }
    const ts = Number(name.split('_')[1]);
    if (isNaN(ts)) {
      return false;
    }
    const createdAt = DateTime.fromMillis(ts);
    // more than 1 hour old
    return createdAt.diffNow().as('hours') < -1;
  });

  await Promise.all(stale.map((branch) => db.execute(`drop branch ${branch}`)));
}
