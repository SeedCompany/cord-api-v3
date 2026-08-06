/**
 * Scrub a restored production copy so it is safe to develop and rehearse against.
 *
 * WHY THIS EXISTS. Several domains — prompt answers, posts, producibles, status
 * history — carry real volume in production and are empty or near-empty locally,
 * so their migration code has never actually executed. No amount of running
 * against local test data changes that. A scrubbed production copy exercises
 * those paths, and doubles as a dev environment that resembles reality.
 *
 * Boots with `DATABASE=neo4j` so the Neo4j connection is the one in play. This
 * writes to that graph in place, so point it at a RESTORED COPY, never at
 * production.
 *
 * Usage:
 *   # count what would change, write nothing
 *   yarn start --entryFile core/scrub.run -- --dry-run
 *
 *   # scrub, then verify
 *   SCRUB_DEV_PASSWORD=localdev yarn start --entryFile core/scrub.run
 *
 *   # verify an already-scrubbed copy (safe to re-run any time)
 *   yarn start --entryFile core/scrub.run -- --verify-only
 *
 * Flags: --dry-run | --verify-only | --restamp | --batch=N
 *
 * `--restamp` re-records the marker with the CURRENT classification hash, without
 * touching any value. Only correct when the classification changed and the copy
 * already satisfies the new version — e.g. a field was reclassified as an enum to
 * leave alone, and its values were separately restored. It is not a way to silence
 * a stale-copy refusal: if the data does not match the classification, re-scrub.
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import '../polyfills';

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const has = (name: string) => argv.includes(`--${name}`);
  return {
    dryRun: has('dry-run'),
    verifyOnly: has('verify-only'),
    restamp: has('restamp'),
    batchSize: get('batch') ? Number(get('batch')) : 1000,
  };
};

async function bootstrap() {
  // Flags first, THEN push 'console' so ConfigService.isCli is true (loaders
  // resolve against the CLI context, scheduler off) — same order as
  // cutover.run.ts and repl.ts.
  const flags = parseFlags(process.argv.slice(2));
  process.argv.push('console');

  const { AppModule } = await import('../app.module');
  const { DatabaseService } = await import('~/core/neo4j');
  const { CryptoService } =
    await import('~/core/authentication/crypto.service');
  const { runScrub } = await import('./scrub/scrub');
  const { runVerify } = await import('./scrub/verify');
  const { readProvenance, stampProvenance } =
    await import('./scrub/provenance');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const neo4j = app.get(DatabaseService);
  // Same as cutover.run.ts: this is a CLI script whose output IS the interface.
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);

  try {
    if (flags.restamp) {
      const before = await readProvenance(neo4j);
      if (!before) {
        throw new Error(
          'Refusing to restamp: this graph carries no scrub marker, so there is ' +
            'nothing to re-record. Run the scrub.',
        );
      }
      await stampProvenance(neo4j, {
        scrubbedValues: before.scrubbedValues,
        deletedKeys: before.deletedKeys,
        at: new Date().toISOString(),
      });
      const after = await readProvenance(neo4j);
      log(
        `\nRe-recorded the marker: classification ${
          before.classificationHash
        } -> ${after?.classificationHash ?? '(marker unreadable)'}\n` +
          'No values were touched.\n',
      );
    } else if (flags.verifyOnly) {
      const provenance = await readProvenance(neo4j);
      log(
        provenance
          ? `\nMarked scrubbed ${provenance.scrubbedAt} — ${provenance.scrubbedValues} values replaced, classification ${provenance.classificationHash}\n`
          : '\n⚠ No scrub marker on this graph.\n',
      );
    } else {
      const crypto = app.get(CryptoService);
      const devPassword = process.env.SCRUB_DEV_PASSWORD;
      if (!devPassword && !flags.dryRun) {
        throw new Error(
          'SCRUB_DEV_PASSWORD is required for a real run — every account in the ' +
            'copy is set to it, and it is the only way to log in afterwards.',
        );
      }
      const devPasswordHash = devPassword
        ? await crypto.hash(devPassword)
        : 'dry-run';

      log(
        flags.dryRun
          ? '\nDRY RUN — counting only, nothing is written.\n'
          : '\nScrubbing in place. This rewrites the graph it is pointed at.\n',
      );

      const report = await runScrub({
        neo4j,
        batchSize: flags.batchSize,
        log,
        devPasswordHash,
        dryRun: flags.dryRun,
      });

      log(
        `\n${flags.dryRun ? 'Would replace' : 'Replaced'} ${report.scrubbedValues} value(s), ` +
          `${flags.dryRun ? 'clear' : 'cleared'} ${report.credentialsCleared} credential(s), ` +
          `${flags.dryRun ? 'remove' : 'removed'} ${report.deletedKeys} dead key value(s).`,
      );
    }

    // Verification always runs, including after a dry run — on an unscrubbed
    // graph it reports what is currently exposed, which is a useful baseline and
    // proves the probes actually fire rather than passing vacuously.
    log('\nVerifying —');
    const verify = await runVerify(neo4j);
    if (verify.clean) {
      log('  no violations.');
    } else {
      for (const violation of verify.violations) {
        log(`  ✗ ${violation.field}: ${violation.count} — ${violation.probe}`);
      }
    }
    for (const item of verify.watchlist) {
      log(`  • ${item.field}: ${item.count} — ${item.probe}`);
    }

    if (!flags.dryRun && !flags.verifyOnly && !verify.clean) {
      log(
        '\n⚠ Scrub completed but verification found survivors. Treat this copy as ' +
          'unscrubbed until the fields above are resolved.',
      );
      await app.close();
      exit(1);
    }

    await app.close();
    exit(0);
  } catch (error) {
    log(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
    await app.close();
    exit(1);
  }
}

await bootstrap();
