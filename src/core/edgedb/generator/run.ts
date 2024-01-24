import { createClient } from 'edgedb';
import { IndentationText, Project, QuoteKind } from 'ts-morph';
import { codecs, registerCustomScalarCodecs } from '../codecs';
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
  };

  await registerCustomScalarCodecs(client, codecs);
  setTsTypesFromOurScalarCodecs();

  try {
    await generateQueryBuilder(params);
    await generateSchema(params);
    await generateQueryFiles(params);
    await generateInlineQueries(params);
  } finally {
    await client.close();
  }

  await project.save();

  console.log('Done!');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
