import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  ID,
  IdField,
  IdOf,
  Resource,
  RichTextDocument,
  RichTextField,
  SecuredRichText,
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
export abstract class VariantResponse<Key extends string = string> {
  @Field()
  readonly variant: Variant<Key>;

  @Field()
  readonly response: SecuredRichText;
}

@ObjectType()
export class PromptVariantResponse<
  Key extends string = string
> extends Resource {
  readonly parent: ResourceRef<any>;

  static Relations = {
    // So the policies can specify
    responses: [VariantResponse],
  };
  @Field()
  readonly prompt: SecuredPrompt;

  @Field(() => [VariantResponse])
  readonly responses: ReadonlyArray<VariantResponse<Key>>;
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
