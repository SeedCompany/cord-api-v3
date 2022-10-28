import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredRichText } from '~/common';
import { Prompt } from './prompt.dto';

@ObjectType()
export class PromptResponse extends Resource {
  @Field()
  readonly prompt: Prompt;

  @Field()
  readonly response: SecuredRichText;
}

@ObjectType()
export class PromptVariantResponse extends Resource {
  @Field()
  readonly prompt: Prompt;

  @Field(() => [VariantResponse])
  readonly responses: readonly VariantResponse[];
}

@ObjectType()
export abstract class VariantResponse {
  @Field()
  readonly variant: string;

  @Field()
  readonly response: SecuredRichText;
}
