import { Field, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';

@ObjectType()
export class SecurityGroup {
  @IdField()
  readonly id: string;

  @Field()
  readonly name: string;
}
