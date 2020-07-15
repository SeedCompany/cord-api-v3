import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class PromoteUserToAdminOfBaseNode {
  @IdField()
  readonly baseNodeId: string;

  @IdField()
  readonly userId: string;
}

@InputType()
export abstract class PromoteUserToAdminOfBaseNodeInput {
  @Field()
  readonly request: PromoteUserToAdminOfBaseNode;
}
