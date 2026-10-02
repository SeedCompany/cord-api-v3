import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  type Secured,
  SecuredInt,
  SecuredRichTextNullable,
  SecuredString,
  type Sensitivity,
} from '~/common';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { type ScopedRole } from '../../authorization/dto/role.dto';

/**
 * Practicum and workshop involvement reported for a quarter.
 *
 * A row is three independent fields, one of which is a person, so it gets its
 * own table rather than riding the PromptVariantResponse machinery the prose
 * sections use.
 */
@RegisterResource()
@ObjectType({ implements: [Resource] })
export class GtlReportPracticum extends Resource {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);

  readonly report: LinkTo<'GTLReport'>;

  @Field({ description: 'The practicum or workshop involved in' })
  readonly involvement: SecuredString;

  readonly mentor: Secured<LinkTo<'User'> | null>;

  @Field({ description: 'What came of it' })
  readonly outcomes: SecuredRichTextNullable;

  @Field()
  readonly order: SecuredInt;

  /** The owning project's, for the sensitivity policy conditions. */
  readonly sensitivity: Sensitivity;

  /** The requester's membership roles on the owning project. */
  declare readonly scope: readonly ScopedRole[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlReportPracticum: typeof GtlReportPracticum;
  }
}
