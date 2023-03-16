import { InputType } from '@nestjs/graphql';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';

@InputType()
export class CreateOutcomeInput {
  @IdField()
  engagement: ID;

  @RichTextField()
  description: RichTextDocument;

  @IdField({ nullable: true })
  report?: ID;
}
