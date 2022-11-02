import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Min } from 'class-validator';
import { DateTime } from 'luxon';
import {
  ID,
  IdField,
  Resource,
  RichTextDocument,
  RichTextField,
  SecuredInt,
  SecuredProperty,
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

  /** Fake DB entry for now. */
  static create({ id, text }: { id: string; text: string }): Prompt {
    return {
      id: id as ID,
      createdAt: DateTime.now(),
      text: {
        canRead: true,
        canEdit: false,
        value: RichTextDocument.fromText(text),
      },
      min: { value: 1, canRead: true, canEdit: false },
      max: { value: 1, canRead: true, canEdit: false },
      canDelete: false,
    };
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a prompt'),
})
export class SecuredPrompt extends SecuredProperty(Prompt) {}

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
