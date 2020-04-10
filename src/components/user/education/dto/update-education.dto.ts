import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Degree, Education } from './education.dto';

@InputType()
export abstract class UpdateEducation {
  @Field(() => ID)
  readonly id: string;

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
