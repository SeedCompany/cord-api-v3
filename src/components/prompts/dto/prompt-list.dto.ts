import { Field, ObjectType } from '@nestjs/graphql';
import { Prompt } from './prompt.dto';
import { Variant } from './variant.dto';

@ObjectType()
export abstract class PromptList {
  @Field(() => [Prompt])
  readonly prompts: readonly Prompt[];
}

@ObjectType()
export abstract class VariantPromptList<
  VariantKey extends string = string
> extends PromptList {
  @Field(() => [Variant])
  readonly variants: ReadonlyArray<Variant<VariantKey>>;
}
