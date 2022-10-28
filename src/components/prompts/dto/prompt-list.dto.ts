import { Field, ObjectType } from '@nestjs/graphql';
import { Prompt } from './prompt.dto';
import { Variant } from './variant.dto';

@ObjectType()
export abstract class PromptList {
  @Field(() => [Prompt])
  readonly prompts: readonly Prompt[];
}

@ObjectType()
export abstract class VariantPromptList extends PromptList {
  @Field(() => [Variant])
  readonly variants: readonly Variant[];
}
