import { Field, ObjectType } from '@nestjs/graphql';
import { Prompt } from './prompt.dto';

@ObjectType()
export abstract class PromptList {
  @Field(() => [Prompt])
  readonly prompts: readonly Prompt[];
}

@ObjectType()
export abstract class VariantPromptList extends PromptList {
  @Field(() => [String])
  readonly variants: readonly string[];
}
