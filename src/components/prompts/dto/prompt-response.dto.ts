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
import { Prompt } from './prompt.dto';
import { Variant } from './variant.dto';

@ObjectType()
export class PromptResponse extends Resource {
  readonly parent: ResourceRef<any>;

  @Field()
  readonly prompt: Prompt;

  @Field()
  readonly response: SecuredRichText;
}

@ObjectType()
export class PromptVariantResponse extends Resource {
  readonly parent: ResourceRef<any>;

  @Field()
  readonly prompt: Prompt;

  @Field(() => [VariantResponse])
  readonly responses: readonly VariantResponse[];
}

@ObjectType()
export abstract class VariantResponse {
  @Field()
  readonly variant: Variant;

  @Field()
  readonly response: SecuredRichText;
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
export abstract class UpdatePromptVariantResponse {
  @IdField()
  readonly id: IdOf<PromptVariantResponse>;

  @IdField()
  readonly variant: ID;

  @RichTextField()
  readonly response: RichTextDocument;
}
