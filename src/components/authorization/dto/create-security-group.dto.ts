import { Field, ID, InputType, ObjectType } from 'type-graphql';

@InputType()
export class CreateSecurityGroup {
  @Field()
  readonly name: string;
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
  @Field(() => ID, { nullable: true })
  id: string | null;
}
