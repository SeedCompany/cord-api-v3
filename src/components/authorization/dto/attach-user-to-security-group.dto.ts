import { Field, InputType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@InputType()
export class AttachUserToSecurityGroup {
  @IdField()
  readonly sgId: string;

  @IdField()
  readonly userId: string;
}

@InputType()
export abstract class AttachUserToSecurityGroupInput {
  @Field()
  readonly request: AttachUserToSecurityGroup;
}
