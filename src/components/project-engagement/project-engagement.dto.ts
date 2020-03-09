import { DateTime } from 'luxon';
import { Field, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../common';
import { ProjectEngagement } from './engagement';

// CREATE

@InputType()
export class CreateProjectEngagementInput {
  @Field(() => String)
  languageName: string;
}

@InputType()
export class CreateProjectEngagementInputDto {
  @Field()
  projectEngagement: CreateProjectEngagementInput;
}

@ObjectType()
export class CreateProjectEngagementOutput {
  @Field(() => String)
  id: string;

  @Field(() => String)
  languageName: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;

  @DateField({ nullable: true })
  updatedAt: DateTime | null;
}

@ObjectType()
export class CreateProjectEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  projectEngagement: CreateProjectEngagementOutput;
  constructor() {
    this.projectEngagement = new CreateProjectEngagementOutput();
  }
}

// READ

@InputType()
export class ReadProjectEngagementInput {
  @Field(() => String)
  id: string;
}

@InputType()
export class ReadProjectEngagementInputDto {
  @Field()
  projectEngagement: ReadProjectEngagementInput;
}

@ObjectType()
export class ReadProjectEngagementOutput {
  @Field(() => String)
  id: string;

  @Field(() => String)
  languageName: string;
}

@ObjectType()
export class ReadProjectEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  projectEngagement: ReadProjectEngagementOutput;
  constructor() {
    this.projectEngagement = new ReadProjectEngagementOutput();
  }
}

// UPDATE

@InputType()
export class UpdateProjectEngagementInput {
  @Field(() => String)
  id: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@InputType()
export class UpdateProjectEngagementInputDto {
  @Field()
  projectEngagement: UpdateProjectEngagementInput;
}

@ObjectType()
export class UpdateProjectEngagementOutput {
  @Field(() => String)
  id: string;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;
}

@ObjectType()
export class UpdateProjectEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  projectEngagement: UpdateProjectEngagementOutput;
  constructor() {
    this.projectEngagement = new UpdateProjectEngagementOutput();
  }
}

// DELETE

@InputType()
export class DeleteProjectEngagementInput {
  @Field(() => String)
  id: string;
}

@InputType()
export class DeleteProjectEngagementInputDto {
  @Field()
  projectEngagement: DeleteProjectEngagementInput;
}

@ObjectType()
export class DeleteProjectEngagementOutput {
  @Field(() => String)
  id: string;
}

@ObjectType()
export class DeleteProjectEngagementOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  projectEngagement: DeleteProjectEngagementOutput;
  constructor() {
    this.projectEngagement = new DeleteProjectEngagementOutput();
  }
}
// List all languages (query)

@InputType()
export class ListProjectEngagementsInput {
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
export class ListProjectEngagementsInputDto {
  @Field()
  query: ListProjectEngagementsInput;
}

@ObjectType()
export class ListProjectEngagementsOutput {
  @Field(() => ProjectEngagement, { nullable: true })
  projectEngagement: ProjectEngagement;
}

@ObjectType()
export class ListProjectEngagementsOutputDto {
  @Field(() => [ProjectEngagement], { nullable: true }) // nullable in case of error
  projectEngagements: ProjectEngagement[];
  constructor() {
    this.projectEngagements = [];
  }
}
