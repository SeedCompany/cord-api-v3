import { Field, ObjectType } from '@nestjs/graphql';

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
