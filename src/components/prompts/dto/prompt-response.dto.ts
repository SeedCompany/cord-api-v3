import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredRichText } from '~/common';
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
