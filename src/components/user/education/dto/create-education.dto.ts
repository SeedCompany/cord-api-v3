import { Field, InputType, ObjectType } from '@nestjs/graphql';
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

@ObjectType()
export abstract class EducationCreated {
  @Field()
  readonly education: Education;
}
