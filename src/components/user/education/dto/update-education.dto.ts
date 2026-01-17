import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField, OptionalField } from '~/common';
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

@ObjectType()
export abstract class EducationUpdated {
  @Field()
  readonly education: Education;
}
