import { DateTime } from 'luxon';
import { Field, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../common';
import { User } from '../user';
import { InternshipEngagement } from './engagement';

// CREATE

@InputType()
export class CreateInternshipEngagementInput {
  @Field(() => String)
  internId: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@InputType()
export class CreateInternshipEngagementInputDto {
  @Field()
  internshipEngagement: CreateInternshipEngagementInput;
}

@ObjectType()
export class CreateInternshipEngagementOutput {
  @Field(() => String)
  id: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@ObjectType()
export class CreateInternshipEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internshipEngagement: CreateInternshipEngagementOutput;

  @Field({ nullable: true }) // nullable in case of error
  intern: User;
  constructor() {
    this.internshipEngagement = new CreateInternshipEngagementOutput();
  }
}

// READ

@InputType()
export class ReadInternshipEngagementInput {
  @Field(() => String)
  id: string;
}

@InputType()
export class ReadInternshipEngagementInputDto {
  @Field()
  internshipEngagement: ReadInternshipEngagementInput;
}

@ObjectType()
export class ReadInternshipEngagementOutput {
  @Field(() => String)
  id: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@ObjectType()
export class ReadInternshipEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internshipEngagement: ReadInternshipEngagementOutput;

  @Field({ nullable: true }) // nullable in case of error
  intern: User;
  constructor() {
    this.internshipEngagement = new ReadInternshipEngagementOutput();
  }
}

// UPDATE

@InputType()
export class UpdateInternshipEngagementInput {
  @Field(() => String)
  id: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@InputType()
export class UpdateInternshipEngagementInputDto {
  @Field()
  internshipEngagement: UpdateInternshipEngagementInput;
}

@ObjectType()
export class UpdateInternshipEngagementOutput {
  @Field(() => String)
  id: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@ObjectType()
export class UpdateInternshipEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internshipEngagement: UpdateInternshipEngagementOutput;

  @Field({ nullable: true }) // nullable in case of error
  intern: User;
  constructor() {
    this.internshipEngagement = new UpdateInternshipEngagementOutput();
  }
}

// DELETE

@InputType()
export class DeleteInternshipEngagementInput {
  @Field(() => String)
  id: string;
}

@InputType()
export class DeleteInternshipEngagementInputDto {
  @Field()
  internshipEngagement: DeleteInternshipEngagementInput;
}

@ObjectType()
export class DeleteInternshipEngagementOutput {
  @Field(() => String)
  id: string;
}

@ObjectType()
export class DeleteInternshipEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  internshipEngagement: DeleteInternshipEngagementOutput;
  constructor() {
    this.internshipEngagement = new DeleteInternshipEngagementOutput();
  }
}

// List all interns (query)

@InputType()
export class ListInternshipEngagementsInput {
  @Field(() => String, { nullable: true, defaultValue: '' })
  filter: string;
  @Field(() => Number, { nullable: true, defaultValue: 0 })
  page: number;
  @Field(() => Number, { nullable: true, defaultValue: 25 })
  count: number;
  @Field(() => String, { nullable: true, defaultValue: 'DESC' })
  order: string;
  @Field(() => String, { nullable: true, defaultValue: 'name' })
  sort: string;
}

@InputType()
export class ListInternshipEngagementsInputDto {
  @Field()
  query: ListInternshipEngagementsInput;
}

@ObjectType()
export class ListInternshipEngagementsOutput {
  @Field(() => InternshipEngagement, { nullable: true })
  internshipEngagement: InternshipEngagement;
}

@ObjectType()
export class ListInternshipEngagementsOutputDto {
  @Field(() => [InternshipEngagement], { nullable: true }) // nullable in case of error
  internshipEngagements: InternshipEngagement[];
  constructor() {
    this.internshipEngagements = [];
  }
}
