import { Field, InputType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

@InputType()
export abstract class UpdateProductStep {
  @IdField()
  readonly id: ID;

  @Field()
  readonly name: string;

  @Field({ nullable: true })
  readonly description?: string;

  @Field({ nullable: true })
  readonly progress?: number;
}
