import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '../../../common';

@InputType()
export abstract class RequiredField {
  @IdField()
  readonly stateId: ID;

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
