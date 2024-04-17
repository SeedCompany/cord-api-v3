import { Client, ConnectOptions, createClient } from 'edgedb';
import { DateTime } from 'luxon';

export const ephemeralEdgeDB = async () => {
  if (process.env.DATABASE !== 'edgedb') {
    return undefined;
  }

  const db = createClient();

  await dropStale(db);

  const branch = `test_${Date.now()}`;

  await db.execute(`create schema branch ${branch} from main`);

  const cleanup = async () => {
    await db.execute(`drop branch ${branch}`);
    await db.close();
  };

  const options: ConnectOptions = { branch };

  return { options, cleanup };
};

async function dropStale(db: Client) {
  const branches = await db.query<string>('select sys::Database.name');

  const stale = branches.flatMap((name) => {
    if (!name.startsWith('test_')) {
      return [];
    }
    const ts = Number(name.slice(5));
    if (isNaN(ts)) {
      return [];
    }
    const createdAt = DateTime.fromMillis(ts);
    return createdAt.diffNow().as('hours') > 4 ? name : [];
  });
  if (stale.length === 0) {
    return;
  }
  await db.execute('drop branch array_unpack(<array<string>>$branches)', {
    branches: stale,
  });
}
