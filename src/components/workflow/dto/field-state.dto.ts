import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';

@InputType()
export abstract class RequiredField {
  @IdField()
  readonly stateId: string;

  @Field()
  readonly propertyName: string;
}

@InputType()
export abstract class RequiredFieldInput {
  @Field()
  @Type(() => RequiredField)
  @ValidateNested()
  readonly field: RequiredField;
}
