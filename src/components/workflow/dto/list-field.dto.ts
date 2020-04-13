import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class FieldObject {
  @Field()
  readonly value: string;
}

@ObjectType()
export class RequiredFieldListOutput {
  @Field(() => [FieldObject])
  readonly items: FieldObject[];
}
