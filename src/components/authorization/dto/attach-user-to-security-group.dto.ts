import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class AttachUserToSecurityGroup {
  @Field(() => ID)
  readonly sgId: string;

  @Field(() => ID)
  readonly userId: string;
}

@InputType()
export abstract class AttachUserToSecurityGroupInput {
  @Field()
  readonly request: AttachUserToSecurityGroup;
}
