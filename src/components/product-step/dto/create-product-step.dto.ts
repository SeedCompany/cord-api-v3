import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';
import { ProductStep } from './product-step.dto';

@InputType()
export class CreateProductStep {
  @IdField()
  readonly productId: ID;

  @Field()
  readonly name: string;

  @Field({ nullable: true })
  readonly description?: string;

  @Field({ nullable: true })
  readonly progress?: number;
}

@InputType()
export abstract class CreateProductStepInput {
  @Field()
  @Type(() => CreateProductStep)
  @ValidateNested()
  readonly productStep: CreateProductStep;
}

@ObjectType()
export abstract class CreateProductStepOutput {
  @Field()
  readonly productStep: ProductStep;
}
