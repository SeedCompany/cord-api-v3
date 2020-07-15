import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class PromoteUserToAdminOfSecurityGroup {
  @IdField()
  readonly sgId: string;

  @IdField()
  readonly userId: string;
}

@InputType()
export abstract class PromoteUserToAdminOfSecurityGroupInput {
  @Field()
  readonly request: PromoteUserToAdminOfSecurityGroup;
}
