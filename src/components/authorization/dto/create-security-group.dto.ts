import { Field, InputType, ObjectType } from 'type-graphql';

@InputType()
export class CreateSecurityGroup {
  @Field()
  readonly name: string; // the user who is receiving the new permission
}

@InputType()
export abstract class CreateSecurityGroupInput {
  @Field()
  readonly request: CreateSecurityGroup;
}

@ObjectType()
export class CreateSecurityGroupOutput {
  @Field()
  success: boolean;
  @Field(() => String, { nullable: true })
  id: string | null;
}
