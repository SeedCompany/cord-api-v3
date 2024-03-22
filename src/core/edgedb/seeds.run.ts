import { many, MaybeAsync } from '@seedcompany/common';
import { BaseContext, Command, runExit } from 'clipanion';
import { Client, createClient, Executor } from 'edgedb';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import { inspect } from 'util';
import { e } from './reexports';

type Query = string | QBQuery;
interface QBQuery {
  run: (client: Executor) => Promise<any>;
}

export type SeedFn = (
  params: SeedParams,
) => MaybeAsync<void | Query | Iterable<Query> | AsyncIterable<Query>>;

interface SeedParams {
  e: typeof e;
  runAndPrint: (query: Query) => Promise<void>;
  db: Client;
  print: (something: unknown) => void;
  context: BaseContext;
}

const db = createClient().withConfig({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  allow_user_specified_id: true,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  apply_access_policies: false,
});

class SeedCommand extends Command {
  async execute() {
    let code = 0;
    const files = await glob('./dbschema/seeds/**/*.{edgeql,ts}');
    files.sort((a, b) => a.localeCompare(b));

    const colors = this.context.colorDepth > 1;
    const printResult = (result: unknown) => {
      for (const row of many(result)) {
        this.context.stdout.write(inspect(row, { colors }) + '\n');
      }
    };

    const runAndPrint = async (query: Query) => {
      try {
        const rows =
          typeof query === 'string'
            ? await db.query(query)
            : await query.run(db);
        printResult(rows);
      } catch (e) {
        this.context.stderr.write((e as Error).message + '\n');
        code = 1;
      }
    };
    const params: SeedParams = {
      db,
      context: this.context,
      print: printResult,
      runAndPrint,
      e,
    };

    for (const file of files) {
      if (file.endsWith('.edgeql')) {
        const query = await fs.readFile(file, 'utf-8');
        await runAndPrint(query);
      } else {
        const script = await import('../../../' + file);
        const queries = await (script.default as SeedFn)(params);
        if (!queries) {
          continue;
        }
        const casted =
          typeof queries === 'string' ||
          (typeof queries === 'object' && 'run' in queries)
            ? [queries]
            : queries;
        for await (const query of casted) {
          await runAndPrint(query);
        }
      }
    }

    return code;
  }

  async validateAndExecute() {
    try {
      return await super.validateAndExecute();
    } finally {
      await db.close();
    }
  }
}
await runExit(SeedCommand);
