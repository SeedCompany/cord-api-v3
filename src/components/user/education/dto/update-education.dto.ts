import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField } from '~/common';
import { Degree, Education } from './education.dto';

@InputType()
export abstract class UpdateEducation {
  @IdField()
  readonly id: ID;

  @Field(() => Degree, { nullable: true })
  readonly degree?: Degree;

  @Field({ nullable: true })
  readonly major?: string;

  @Field({ nullable: true })
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
