import { many } from '@seedcompany/common';
import { Command, runExit } from 'clipanion';
import { createClient } from 'edgedb';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import { inspect } from 'util';

const db = createClient().withConfig({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  allow_user_specified_id: true,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  apply_access_policies: false,
});

class SeedCommand extends Command {
  async execute() {
    let code = 0;
    const files = await glob('./dbschema/seeds/**/*.edgeql');
    files.sort((a, b) => a.localeCompare(b));

    const colors = this.context.colorDepth > 1;
    const printResult = (result: unknown) => {
      for (const row of many(result)) {
        this.context.stdout.write(inspect(row, { colors }) + '\n');
      }
    };

    const runQuery = async (query: string) => {
      try {
        const rows = await db.query(query);
        printResult(rows);
      } catch (e) {
        this.context.stderr.write((e as Error).message + '\n');
        code = 1;
      }
    };

    for (const file of files) {
      const query = await fs.readFile(file, 'utf-8');
      await runQuery(query);
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
