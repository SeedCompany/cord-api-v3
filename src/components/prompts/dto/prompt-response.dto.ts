import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DbLabel,
  type ID,
  IdField,
  type IdOf,
  Resource,
  type ResourceRelationsShape,
  type RichTextDocument,
  RichTextField,
  type Secured,
  SecuredRichText,
  SecuredRichTextNullable,
  type SetUnsecuredType,
  type UnsecuredDto,
  Variant,
} from '~/common';
import { type LinkTo, type LinkToUnknown } from '~/core';
import { type BaseNode } from '~/core/database/results';
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
  readonly prompt: SecuredPrompt & SetUnsecuredType<IdOf<Prompt>>;

  @Field(() => [VariantResponse])
  readonly responses: ReadonlyArray<VariantResponse<Key>> &
    SetUnsecuredType<ReadonlyArray<UnsecuredDto<VariantResponse<Key>>>>;

  @Field()
  readonly modifiedAt: DateTime;
}

@InputType()
export abstract class ChoosePrompt {
  @IdField()
  readonly resource: ID;

  @IdField()
  readonly prompt: IdOf<Prompt>;
}

@InputType()
export abstract class ChangePrompt {
  @IdField()
  readonly id: IdOf<PromptResponse | PromptVariantResponse>;

  @IdField()
  readonly prompt: IdOf<Prompt>;
}

@InputType()
export abstract class UpdatePromptVariantResponse<Key extends string = ID> {
  @IdField()
  readonly id: IdOf<PromptVariantResponse>;

  @IdField()
  readonly variant: Key;

  @RichTextField({ nullable: true })
  readonly response: RichTextDocument | null;
}
