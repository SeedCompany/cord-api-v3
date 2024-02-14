import { cleanSplit, mapEntries } from '@seedcompany/common';
import { adapter } from 'edgedb';
import { $ as $$ } from 'execa';
import { readFile } from 'fs/promises';
import { Directory, Node, SyntaxKind } from 'ts-morph';
import { hydratorsNeeded, injectHydrators } from './inject-hydrators';
import { GeneratorParams, toFqn } from './util';

interface Hydrator {
  fqn: string;
  type: string;
  query: string;
  fields: string;
  source: string;
  dependencies: Set<string>;
}
export type HydratorMap = ReadonlyMap<string, Hydrator>;

export async function findHydrationShapes({ root }: GeneratorParams) {
  const queries = await Promise.all([
    findInQueryFiles(root),
    findInInlineQueries(root),
  ]);

  const unsorted = mapEntries(queries.flat(), ({ query, source }, { SKIP }) => {
    const matches = query.match(RE_SELECT_NAME_AND_FIELDS);
    if (!matches) {
      return SKIP;
    }
    const [_, type] = matches;
    const fqn = toFqn(type);
    const dependencies = hydratorsNeeded(query);
    const hydrator: Hydrator = {
      fqn,
      type,
      query,
      source,
      dependencies,
      fields: '',
    };
    return [fqn, hydrator];
  }).asMap;

  const hydrators = topoSort(unsorted);

  for (const hydrator of hydrators.values()) {
    hydrator.query = injectHydrators(hydrator.query, hydrators);
    hydrator.fields = hydrator.query.match(RE_SELECT_NAME_AND_FIELDS)![2];
  }

  return hydrators;
}

function topoSort(map: HydratorMap): HydratorMap {
  const sorted = new Map<string, Hydrator>();
  const visiting = new Set<string>();

  const visit = (hydrator: Hydrator) => {
    if (visiting.has(hydrator.fqn)) {
      const last = Array.from(visiting).at(-1)!;
      throw new Error(
        `Circular dependency involving ${hydrator.type} and ${last}`,
      );
    }
    visiting.add(hydrator.fqn);
    for (const dep of hydrator.dependencies) {
      const depHydrator = map.get(dep);
      if (!depHydrator) {
        throw new Error(`Hydrator ${dep} referenced but not defined`);
      }
      visit(depHydrator);
    }
    sorted.set(hydrator.fqn, hydrator);
    visiting.delete(hydrator.fqn);
  };

  for (const type of map.values()) {
    visit(type);
  }

  return sorted;
}

async function findInQueryFiles(root: Directory) {
  const grepForShortList = await $$({
    reject: false,
    cwd: root.getPath(),
  })`find src -type f -name hydrate*.edgeql`;
  const shortList = grepForShortList.stdout
    ? grepForShortList.stdout.split('\n')
    : [];
  const all = await Promise.all(
    shortList.map(async (path) => {
      const contents = await readFile(path, 'utf8');
      return { contents, source: './' + path };
    }),
  );
  return all.flatMap(({ contents, source }) =>
    cleanSplit(contents, ';').map((query) => ({ query, source })),
  );
}

async function findInInlineQueries(root: Directory) {
  const grepForShortList = await $$({
    reject: false,
    cwd: root.getPath(),
  })`grep -lRE ${` hydrate\\w+ = edgeql`} src --exclude-dir=src/core/edgedb`;
  const shortList = grepForShortList.stdout
    ? root.addSourceFilesAtPaths(grepForShortList.stdout.split('\n'))
    : [];
  return (
    shortList.flatMap((file) =>
      file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
        if (call.getExpression().getText() !== 'edgeql') {
          return [];
        }
        const args = call.getArguments();

        if (
          args.length > 1 ||
          (!Node.isStringLiteral(args[0]) &&
            !Node.isNoSubstitutionTemplateLiteral(args[0]))
        ) {
          return [];
        }
        // Too hard to find parent types that have name
        if (!(call as any).getParent()?.getName()?.includes('hydrate')) {
          return [];
        }

        const path = adapter.path.posix.relative(
          root.getPath(),
          call.getSourceFile().getFilePath(),
        );
        const lineNumber = call.getStartLineNumber();
        const source = `./${path}:${lineNumber}`;

        const query = args[0].getText().slice(1, -1);
        return { query, source };
      }),
    ) ?? []
  );
}

const RE_SELECT_NAME_AND_FIELDS = /select ([\w:]+) \{((?:.|\n)+)}/i;
