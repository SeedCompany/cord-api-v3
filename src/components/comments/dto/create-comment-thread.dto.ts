import { InputType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

@InputType()
export abstract class CreateCommentThreadInput {
  @IdField()
  readonly parentId: ID;
}
