import { InputType } from '@nestjs/graphql';
import { ID, IdField, RichTextDocument, RichTextField } from '~/common';

@InputType()
export class UpdateOutcomeInput {
  @IdField()
  id: ID;

  @RichTextField()
  description?: RichTextDocument;
}
