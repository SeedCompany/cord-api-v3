import { Field, InputType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

@InputType()
export class CreateOrUpdateProductStep {
  @IdField({ nullable: true })
  readonly productId?: ID;

  @IdField({ nullable: true })
  readonly id?: ID;

  @Field()
  readonly name: string;

  @Field({ nullable: true })
  readonly description?: string;

  @Field({ nullable: true })
  readonly progress?: number;
}
