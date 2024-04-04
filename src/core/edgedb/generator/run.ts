import { createClient } from 'edgedb';
import fs from 'node:fs/promises';
import { IndentationText, Project, QuoteKind } from 'ts-morph';
import { codecs, registerCustomScalarCodecs } from '../codecs';
import { findHydrationShapes } from './find-hydration-shapes';
import { generateSchema } from './generate-schema';
import { generateInlineQueries } from './inline-queries';
import { generateQueryBuilder } from './query-builder';
import { generateQueryFiles } from './query-files';
import { setTsTypesFromOurScalarCodecs } from './scalars';
import { GeneratorParams } from './util';

(async () => {
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
    skipAddingFilesFromTsConfig: true,
    manipulationSettings: {
      indentationText: IndentationText.TwoSpaces,
      quoteKind: QuoteKind.Single,
      useTrailingCommas: true,
    },
  });

  const client = createClient({
    concurrency: 5,
  });
  await client.ensureConnected();

  const params: GeneratorParams = {
    client,
    root: project.addDirectoryAtPath(''),
    edgedbDir: project.addDirectoryAtPath('src/core/edgedb'),
    hydrators: new Map(),
    errors: [],
  };

  await registerCustomScalarCodecs(client, codecs);
  setTsTypesFromOurScalarCodecs();

  try {
    params.hydrators = await findHydrationShapes(params);
    await generateQueryBuilder(params);

    const _skipped = generateSchema; // Skipping for now. Not proven useful.
    await fs.rm('src/core/edgedb/schema').catch(() => null);

    await generateQueryFiles(params);
    await generateInlineQueries(params);
  } finally {
    await client.close();
  }

  await project.save();

  console.log('Done!');

  if (params.errors.length > 0) {
    throw new AggregateError(params.errors);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
