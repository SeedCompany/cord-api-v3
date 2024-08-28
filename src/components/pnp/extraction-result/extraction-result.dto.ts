import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { many, Many } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import * as uuid from 'uuid';
import { EnumType, ID, IdField, makeEnum } from '~/common';
import { InlineMarkdownScalar } from '~/common/markdown.scalar';
import { Cell } from '~/common/xlsx.util';

export type PnpProblemSeverity = EnumType<typeof PnpProblemSeverity>;
export const PnpProblemSeverity = makeEnum({
  name: 'PnpProblemSeverity',
  values: ['Error', 'Warning', 'Notice'],
});

@ObjectType()
export class PnpProblem {
  @IdField()
  readonly id: ID;

  @Field(() => PnpProblemSeverity)
  readonly severity: PnpProblemSeverity;

  @Field(() => InlineMarkdownScalar, {
    description: 'The message describing this specific problem',
  })
  readonly message: string;

  @Field(() => String, {
    description: 'Sheet!A1',
  })
  readonly source: string;

  @Field(() => [InlineMarkdownScalar], {
    description: stripIndent`
      Groupings for this problem.
      Order least specific to most.
      Formatted as human labels.
    `,
  })
  readonly groups: readonly string[];
}

@InterfaceType()
export abstract class PnpExtractionResult {
  constructor(private readonly fileVersionId: ID<'FileVersion'>) {}

  @Field(() => [PnpProblem])
  readonly problems: PnpProblem[] = [];

  addProblem(
    problem: Omit<PnpProblem, 'id' | 'groups' | 'source'> & {
      id?: string;
      groups?: Many<string>;
      source: Cell;
    },
  ) {
    const id = (problem.id ??
      uuid.v5(
        [this.fileVersionId, problem.message, problem.source.fqn].join('\0'),
        ID_NS,
      )) as ID;

    // Ignore dupes
    if (this.problems.some((p) => p.id === id)) return;

    this.problems.push({
      ...problem,
      id,
      groups: [problem.source.sheet.name, ...many(problem.groups ?? [])],
      source: problem.source.fqn,
    });
  }
}
@ObjectType({ implements: PnpExtractionResult })
export class PnpPlanningExtractionResult extends PnpExtractionResult {}
@ObjectType({ implements: PnpExtractionResult })
export class PnpProgressExtractionResult extends PnpExtractionResult {}

const ID_NS = 'bab2666a-a0f5-4168-977d-7ef6399503f9';
