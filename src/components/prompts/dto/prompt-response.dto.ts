import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  ID,
  IdField,
  IdOf,
  Resource,
  RichTextDocument,
  RichTextField,
  SecuredProps,
  SecuredRichText,
  SetUnsecuredType,
} from '~/common';
import { ResourceRef } from '~/core';
import { Prompt, SecuredPrompt } from './prompt.dto';
import { Variant } from './variant.dto';

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

  @Field()
  readonly variant: Variant<Key>;

  @Field()
  readonly response: SecuredRichText;
}

@ObjectType()
export class PromptVariantResponse<
  Key extends string = string
> extends Resource {
  static Props = keysOf<PromptVariantResponse>();
  static SecuredProps = keysOf<SecuredProps<PromptVariantResponse>>();
  static readonly Parent = 'dynamic' as 'dynamic' | Promise<any>;

  static Relations = {
    // So the policies can specify
    responses: [VariantResponse],
  };

  readonly parent: ResourceRef<any>;

  @Field(() => SecuredPrompt)
  readonly prompt: SecuredPrompt & SetUnsecuredType<IdOf<Prompt>>;

  @Field(() => [VariantResponse])
  readonly responses: ReadonlyArray<VariantResponse<Key>> &
    SetUnsecuredType<
      ReadonlyArray<{ variant: Key; response: RichTextDocument | null }>
    >;
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

  @RichTextField()
  readonly response: RichTextDocument;
}
