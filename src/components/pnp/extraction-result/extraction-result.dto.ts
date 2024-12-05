import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { many, Many } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { UUID } from 'node:crypto';
import { Merge } from 'type-fest';
import * as uuid from 'uuid';
import { EnumType, ID, IdField, makeEnum } from '~/common';
import { InlineMarkdownScalar } from '~/common/markdown.scalar';
import { Cell } from '~/common/xlsx.util';

export type PnpProblemSeverity = EnumType<typeof PnpProblemSeverity>;
export const PnpProblemSeverity = makeEnum({
  name: 'PnpProblemSeverity',
  values: ['Error', 'Warning', 'Notice'],
});

export class PnpProblemType<Context> {
  static readonly types = new Map<UUID, PnpProblemType<any>>();

  static register<Context>({
    id: idIn,
    name,
    severity,
    render,
    wiki,
  }: Merge<
    PnpProblemType<Context>,
    { id?: UUID | string }
  >): PnpProblemType<Context> {
    const id = (
      idIn && uuid.validate(idIn) ? idIn : uuid.v5(name, ID_NS)
    ) as UUID;

    const type = Object.assign(new PnpProblemType<Context>(), {
      id,
      name,
      severity,
      render,
      wiki,
    });

    this.types.set(id, type);

    return type;
  }

  id: UUID;
  name: string;
  severity: PnpProblemSeverity;
  wiki?: string;

  render: (
    context: Context,
  ) => (baseCtx: {
    source: string;
    sheet: string;
  }) => Pick<PnpProblemInput, 'message' | 'groups'>;
}

@ObjectType()
export class PnpProblem {
  @IdField()
  readonly id: ID & UUID;

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

  @Field(() => URL, { nullable: true })
  readonly documentation?: string;

  static render(stored: StoredProblem) {
    const type = PnpProblemType.types.get(stored.type);
    if (!type) {
      throw new Error(`Unknown problem type ${stored.type}`);
    }
    const [sheet, source] = stored.source.split('!');
    const rendered = type.render(stored.context)({ sheet, source });
    const props: PnpProblem = {
      id: stored.id,
      severity: type.severity,
      message: rendered.message,
      source: stored.source,
      groups: [sheet, ...many(rendered.groups ?? [])],
      documentation: type.wiki,
    };
    return Object.assign(new PnpProblem(), props);
  }
}

type PnpProblemInput = Omit<PnpProblem, 'id' | 'groups' | 'source'> & {
  id?: string;
  groups?: Many<string>;
  source?: Cell;
};

export type StoredProblem = Pick<PnpProblem, 'id'> & {
  type: UUID;
  source: string;
  context: { [x: string]: unknown };
};

@InterfaceType()
export abstract class PnpExtractionResult {
  constructor(private readonly fileVersionId: ID<'FileVersion'>) {}

  readonly problems = new Map<ID, StoredProblem>();

  addProblem<Ctx>(
    type: PnpProblemType<Ctx>,
    source: Cell,
    context: Omit<Ctx, 'source'>,
  ) {
    const id = uuid.v5(
      [this.fileVersionId, type.id, source.fqn].join('\0'),
      ID_NS,
    ) as ID & UUID;
    this.problems.set(id, {
      id,
      type: type.id,
      source: source.fqn,
      context,
    });
  }
}
@ObjectType({ implements: PnpExtractionResult })
export class PnpPlanningExtractionResult extends PnpExtractionResult {}
@ObjectType({ implements: PnpExtractionResult })
export class PnpProgressExtractionResult extends PnpExtractionResult {}

const ID_NS = 'bab2666a-a0f5-4168-977d-7ef6399503f9';
