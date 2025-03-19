import { clc } from '@nestjs/common/utils/cli-colors.util.js';
import { cleanJoin, many, MaybeAsync } from '@seedcompany/common';
import { BaseContext, Command, runExit } from 'clipanion';
import { Client, createClient, Executor, GelError, Options } from 'gel';
import type { QueryArgs } from 'gel/dist/ifaces';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BehaviorSubject } from 'rxjs';
import { inspect } from 'util';
import { ID } from '~/common';
import { attributesOf } from './errors';
import { OptionsContext, OptionsFn } from './options.context';
import { e } from './reexports';

Error.stackTraceLimit = Infinity;

type Query = string | QBQuery;
interface QBQuery {
  run: (client: Executor) => Promise<any>;
}

export type SeedFn = (
  params: SeedParams,
) => MaybeAsync<void | Query | Iterable<Query> | AsyncIterable<Query>>;

interface SeedParams {
  e: typeof e;
  runAndPrint: (query: Query, args?: QueryArgs) => Promise<void>;
  db: Client;
  print: (something: unknown) => void;
  context: BaseContext;
  actorId: BehaviorSubject<ID | undefined>;
}

const optionsContext = new OptionsContext(
  new Options().withConfig({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    allow_user_specified_id: true,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    apply_access_policies: false,
  }),
);
const db = createClient();
optionsContext.attachToClient(db);

const actor = new BehaviorSubject<ID | undefined>(undefined);
const actorOptions = new BehaviorSubject<OptionsFn>((opts) => opts);
actor.subscribe((actor) => {
  actorOptions.next((options) =>
    actor ? options.withGlobals({ currentActorId: actor }) : options,
  );
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

    const runAndPrint = async (query: Query, args?: QueryArgs) => {
      try {
        const rows =
          typeof query === 'string'
            ? await db.query(query, args)
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
      actorId: actor,
    };

    for (const file of files) {
      await optionsContext.usingOptions(
        (opts) => opts.withWarningHandler(warningHandler(file)),
        async () => {
          if (file.endsWith('.edgeql')) {
            const query = await fs.readFile(file, 'utf-8');
            await runAndPrint(query);
          } else {
            const script = await import('../../../' + file);
            const queries = await (script.default as SeedFn)(params);
            if (!queries) {
              return;
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
        },
      );
    }

    return code;
  }

  async validateAndExecute() {
    try {
      return await optionsContext.usingOptions(actorOptions, async () => {
        return await super.validateAndExecute();
      });
    } finally {
      await db.close();
    }
  }
}
await runExit(SeedCommand);

function warningHandler(seedFile: string) {
  const file = 'file://' + path.resolve(seedFile);
  return (warnings: GelError[]) => {
    for (const warning of warnings) {
      const { lineStart, columnStart } = attributesOf(warning);
      const queryOffset = [lineStart, columnStart];

      const tsFrame = warning
        .stack!.split('\n')
        .find((frame) => frame.includes(file));
      const tsStartMatches = tsFrame?.match(/(\d+):(\d+)\)$/);
      const tsOffset = [
        Number(tsStartMatches?.[1] ?? 0) || undefined,
        Number(tsStartMatches?.[2] ?? 0) || undefined,
      ] as const;

      const src = cleanJoin(':', [
        file,
        ...(file.endsWith('.edgeql') ? queryOffset : tsOffset),
      ]);

      // eslint-disable-next-line no-console
      console.warn(
        clc.yellow(`Warning: ${warning.message}\n`) + `  at ${src}\n`,
      );
    }
  };
}
