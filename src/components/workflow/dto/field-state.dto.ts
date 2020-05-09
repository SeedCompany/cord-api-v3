import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

@InputType()
export abstract class RequiredField {
  @Field(() => ID)
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
