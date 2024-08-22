import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { many, Many } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { EnumType, makeEnum } from '~/common';
import { InlineMarkdownScalar } from '~/common/markdown.scalar';
import { Cell } from '~/common/xlsx.util';

export type PnpProblemSeverity = EnumType<typeof PnpProblemSeverity>;
export const PnpProblemSeverity = makeEnum({
  name: 'PnpProblemSeverity',
  values: ['Error', 'Warning', 'Notice'],
});

@ObjectType()
export class PnpProblem {
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
  @Field(() => [PnpProblem])
  readonly problems: PnpProblem[] = [];

  addProblem(
    problem: Omit<PnpProblem, 'groups' | 'source'> & {
      groups?: Many<string>;
      source: Cell;
    },
  ) {
    this.problems.push({
      ...problem,
      groups: [problem.source.sheet.name, ...many(problem.groups ?? [])],
      source: problem.source.fqn,
    });
  }
}
@ObjectType({ implements: PnpExtractionResult })
export class PnpPlanningExtractionResult extends PnpExtractionResult {}
@ObjectType({ implements: PnpExtractionResult })
export class PnpProgressExtractionResult extends PnpExtractionResult {}
