import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Rev79Community {
  @Field()
  id: string;

  @Field()
  name: string;
}
