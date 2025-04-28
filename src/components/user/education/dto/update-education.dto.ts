import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField, OptionalField } from '~/common';
import { Degree, Education } from './education.dto';

@InputType()
export abstract class UpdateEducation {
  @IdField()
  readonly id: ID;

  @OptionalField(() => Degree)
  readonly degree?: Degree;

  @NameField({ optional: true })
  readonly major?: string;

  @NameField({ optional: true })
  readonly institution?: string;
}

@InputType()
export abstract class UpdateEducationInput {
  @Field()
  @Type(() => UpdateEducation)
  @ValidateNested()
  readonly education: UpdateEducation;
}

@ObjectType()
export abstract class UpdateEducationOutput {
  @Field()
  readonly education: Education;
}
