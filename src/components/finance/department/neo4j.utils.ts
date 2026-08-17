import { type Nil, type NonEmptyArray } from '@seedcompany/common';
import { node, type Pattern, type Query, relation } from 'cypher-query-builder';
import { ACTIVE, apoc, collect, merge, variable } from '~/core/neo4j/query';
import { type FinanceDepartmentIdBlockInput as Input } from './dto/id-blocks.input';

// A fresh pair must be built on every use. cypher-query-builder's
// useParameterBag() mutates a pattern's parameterBag reference in place
// (parameter-container.ts), so a single shared instance reused across
// separate query builds ends up carrying forward — and re-merging — the
// previous build's accumulated parameters every time it's touched, which
// silently doubles the query's parameter count on each reuse for the
// lifetime of the process. A `const` array (even `as const`) only makes the
// TypeScript type readonly; the underlying NodePattern/Relation instances
// are still stateful and mutated by the library.
const defaultRel = (): NonEmptyArray<Pattern> => [
  node('node'),
  relation('out', '', 'departmentIdBlock', ACTIVE),
];
interface Options {
  input?: NonEmptyArray<Pattern>;
  output?: string;
}

export const hydrate =
  ({ input = defaultRel(), output }: Options = {}) =>
  (query: Query) =>
    query.subQuery(input[0].getNameString(), (sub) =>
      sub
        .match([...input, node('block', 'DepartmentIdBlock')])
        .with(
          collect(
            merge('block', {
              blocks: apoc.convert.fromJsonList('block.blocks'),
            }),
          ).as('departmentIdBlocks'),
        )
        .return(`departmentIdBlocks[0] as ${output ?? 'departmentIdBlock'}`),
    );

export const createMaybe =
  (input: Input | Nil, options?: Options) => (query: Query) =>
    !input ? query : query.apply(create(input, options));

export const create =
  (input: Input, { input: inputRel = defaultRel(), output }: Options = {}) =>
  (query: Query) =>
    query.subQuery(inputRel[0].getNameString(), (sub) =>
      sub
        .create([
          ...inputRel,
          node('block', 'DepartmentIdBlock', {
            id: variable(apoc.create.uuid()),
            programs: input.programs ?? [],
            blocks: variable(apoc.convert.toJson(input.blocks)),
          }),
        ])
        .return(`block as ${output ?? 'block'}`),
    );

export const setMaybe =
  (input: Input | Nil, options?: Options) => (query: Query) =>
    input === undefined ? query : query.apply(set(input, options));

export const set =
  (
    input: Input | null,
    { input: inputRel = defaultRel(), output }: Options = {},
  ) =>
  (query: Query) =>
    input
      ? query.apply(upsert(input, { input: inputRel, output }))
      : query.subQuery(inputRel[0].getNameString(), (sub) =>
          sub
            .match([...inputRel, node('block', 'DepartmentIdBlock')])
            .detachDelete('block')
            .return(`collect(block) as ${output ?? 'deleted'}`),
        );

export const upsert =
  (input: Input, { input: inputRel = defaultRel(), output }: Options = {}) =>
  (query: Query) =>
    query.subQuery(inputRel[0].getNameString(), (sub) =>
      sub
        .merge([...inputRel, node('block', 'DepartmentIdBlock')])
        .onCreate.setVariables({
          'block.id': apoc.create.uuid(),
          ...(!input.programs && {
            'block.programs': '[]',
          }),
        })
        .set({
          values: input.programs && {
            'block.programs': input.programs,
          },
          variables: {
            'block.blocks': apoc.convert.toJson(input.blocks),
          },
        })
        .return(`block as ${output ?? 'block'}`),
    );
