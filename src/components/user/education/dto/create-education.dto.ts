import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { Degree, Education } from './education.dto';

@InputType()
export class CreateEducation {
  @IdField()
  readonly user: ID<'User'>;

  @Field(() => Degree)
  readonly degree: Degree;

  @Field()
  readonly major: string;

  @Field()
  readonly institution: string;
}

@InputType()
export abstract class CreateEducationInput {
  @Field()
  @Type(() => CreateEducation)
  @ValidateNested()
  readonly education: CreateEducation;
}

@ObjectType()
export abstract class CreateEducationOutput {
  @Field()
  readonly education: Education;
}
