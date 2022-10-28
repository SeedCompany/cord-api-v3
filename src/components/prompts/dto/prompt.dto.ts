import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Min } from 'class-validator';
import {
  ID,
  IdField,
  Resource,
  RichTextDocument,
  RichTextField,
  SecuredInt,
  SecuredRichText,
} from '~/common';

@ObjectType()
export class Prompt extends Resource {
  @Field()
  readonly text: SecuredRichText;
  @Field()
  readonly min: SecuredInt; // 1
  @Field()
  readonly max: SecuredInt; // 1
}

@InputType()
export abstract class PromptInput {
  @IdField()
  readonly id: ID;

  @RichTextField()
  readonly text?: RichTextDocument;

  @Field(() => Int)
  @Min(0)
  readonly min?: number;

  @Field(() => Int)
  @Min(0)
  readonly max?: number;
}
