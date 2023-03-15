import { Field, ObjectType } from '@nestjs/graphql';
import { Variant } from '~/common';
import { Prompt } from './prompt.dto';

@ObjectType()
export abstract class PromptList {
  @Field(() => [Prompt])
  readonly prompts: readonly Prompt[];
}

@ObjectType()
export abstract class VariantPromptList<
  VariantKey extends string = string,
> extends PromptList {
  @Field(() => [Variant])
  readonly variants: ReadonlyArray<Variant<VariantKey>>;
}
