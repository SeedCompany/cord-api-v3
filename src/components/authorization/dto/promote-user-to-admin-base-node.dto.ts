import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class PromoteUserToAdminOfBaseNode {
  @Field(() => ID)
  readonly baseNodeId: string;

  @Field(() => ID)
  readonly userId: string;
}

@InputType()
export abstract class PromoteUserToAdminOfBaseNodeInput {
  @Field()
  readonly request: PromoteUserToAdminOfBaseNode;
}
