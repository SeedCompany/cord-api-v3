import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DbLabel,
  type ID,
  IdField,
  Resource,
  type ResourceRelationsShape,
  type RichTextDocument,
  RichTextField,
  type Secured,
  SecuredBoolean,
  SecuredRichText,
  SecuredRichTextNullable,
  type SetUnsecuredType,
  type UnsecuredDto,
  Variant,
} from '~/common';
import { type BaseNode } from '~/core/neo4j/results';
import type { LinkTo, LinkToUnknown } from '~/core/resources';
import { type Prompt, SecuredPrompt } from './prompt.dto';

@ObjectType()
export class PromptResponse extends Resource {
  readonly parent: LinkToUnknown;

  @Field()
  readonly prompt: SecuredPrompt;

  @Field()
  readonly response: SecuredRichText;
}

@ObjectType()
@DbLabel(VariantResponse.name, 'Property')
export abstract class VariantResponse<Key extends string = string> {
  @Field(() => Variant)
  readonly variant: Variant<Key> & SetUnsecuredType<Key>;

  @Field()
  readonly response: SecuredRichTextNullable;

  readonly creator: Secured<LinkTo<'User'>>;

  @Field(() => DateTime, { nullable: true })
  readonly modifiedAt?: DateTime;
}

@ObjectType()
export class PromptVariantResponse<
  Key extends string = string,
> extends Resource {
  static readonly Parent = 'dynamic' as 'dynamic' | (() => Promise<any>);

  static readonly Relations = (() => ({
    ...Resource.Relations(),
    // So the policies can specify
    responses: [VariantResponse],
  })) satisfies ResourceRelationsShape;

  readonly creator: Secured<LinkTo<'User'>>;

  readonly parent: BaseNode;

  @Field(() => SecuredPrompt)
  readonly prompt: SecuredPrompt & SetUnsecuredType<ID<Prompt>>;

  @Field(() => [VariantResponse])
  readonly responses: ReadonlyArray<VariantResponse<Key>> &
    SetUnsecuredType<ReadonlyArray<UnsecuredDto<VariantResponse<Key>>>>;

  /**
   * The one item, among however many its parent holds, to surface for an
   * audience that wants exactly one — e.g. the community story chosen for the
   * investor/published report. Always false for subtypes that only ever hold
   * one item per parent (team news, and today's other activities/next
   * quarter): nothing there needs a selection, so nothing sets it.
   *
   * Secured, not a plain boolean: `canEdit` on this field answers "may I make
   * this the featured one?" directly, which the UI reads to decide whether to
   * offer the control and the service reads instead of a separate permission
   * check.
   */
  @Field()
  readonly featured: SecuredBoolean;

  @Field()
  readonly modifiedAt: DateTime;
}

@InputType()
export abstract class ChoosePrompt {
  @IdField()
  readonly resource: ID;

  @IdField()
  readonly prompt: ID<Prompt>;
}

@InputType()
export abstract class ChangePrompt {
  @IdField()
  readonly id: ID<PromptResponse | PromptVariantResponse>;

  @IdField()
  readonly prompt: ID<Prompt>;
}

@InputType()
export abstract class UpdatePromptVariantResponse<Key extends string = ID> {
  @IdField()
  readonly id: ID<PromptVariantResponse>;

  @IdField()
  readonly variant: Key;

  @RichTextField({ nullable: true })
  readonly response: RichTextDocument | null;
}
