import { Field, InputType, ObjectType } from 'type-graphql';

@InputType()
export class AttachUserToSecurityGroup {
  @Field()
  readonly sgId: string;
  readonly userId: string;
}

@InputType()
export abstract class AttachUserToSecurityGroupInput {
  @Field()
  readonly request: AttachUserToSecurityGroup;
}

@ObjectType()
export class AttachUserToSecurityGroupOutput {
  @Field()
  success: boolean;
  @Field(() => String, { nullable: true })
  id: string | null; // id of the permission
}
