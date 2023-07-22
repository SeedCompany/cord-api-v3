import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  ID,
  IdField,
  IdOf,
  Resource,
  ResourceRelationsShape,
  RichTextDocument,
  RichTextField,
  Secured,
  SecuredProps,
  SecuredRichText,
  SecuredRichTextNullable,
  SetUnsecuredType,
  UnsecuredDto,
  Variant,
} from '~/common';
import { ResourceRef } from '~/core';
import { BaseNode } from '~/core/database/results';
import { User } from '../../user';
import { Prompt, SecuredPrompt } from './prompt.dto';

@ObjectType()
export class PromptResponse extends Resource {
  readonly parent: ResourceRef<any>;

  @Field()
  readonly prompt: SecuredPrompt;

  @Field()
  readonly response: SecuredRichText;
}

@ObjectType()
@DbLabel(VariantResponse.name, 'Property')
export abstract class VariantResponse<Key extends string = string> {
  static Props = keysOf<VariantResponse>();
  static SecuredProps = keysOf<SecuredProps<VariantResponse>>();

  @Field(() => Variant)
  readonly variant: Variant<Key> & SetUnsecuredType<Key>;

  @Field()
  readonly response: SecuredRichTextNullable;

  readonly creator: Secured<IdOf<User>>;

  @Field(() => DateTime, { nullable: true })
  readonly modifiedAt?: DateTime;
}

@ObjectType()
export class PromptVariantResponse<
  Key extends string = string,
> extends Resource {
  static Props = keysOf<PromptVariantResponse>();
  static SecuredProps = keysOf<SecuredProps<PromptVariantResponse>>();
  static readonly Parent = 'dynamic' as 'dynamic' | Promise<any>;

  static Relations = {
    // So the policies can specify
    responses: [VariantResponse],
  } satisfies ResourceRelationsShape;

  readonly creator: Secured<IdOf<User>>;

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
