import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, ID, IdField } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { ProductMethodology } from '../../product/dto';
import { InternshipEngagement, LanguageEngagement } from './engagement.dto';
import { InternshipPosition } from './intern-position.enum';
import { EngagementStatus } from './status.enum';

@InputType({
  isAbstract: true,
})
export abstract class CreateEngagement {
  @IdField()
  readonly projectId: ID;

  @DateField({ nullable: true })
  readonly completeDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly disbursementCompleteDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly communicationsCompleteDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly startDateOverride?: CalendarDate;

  @DateField({ nullable: true })
  readonly endDateOverride?: CalendarDate;

  @Field(() => EngagementStatus, { nullable: true })
  readonly status?: EngagementStatus;
}

@InputType()
export abstract class CreateLanguageEngagement extends CreateEngagement {
  @IdField()
  readonly languageId: ID;

  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;

  @Field({ nullable: true })
  readonly paratextRegistryId?: string;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly pnp?: CreateDefinedFileVersionInput;

  @Field({ nullable: true })
  readonly historicGoal?: string;
}

@InputType()
export abstract class CreateInternshipEngagement extends CreateEngagement {
  @IdField()
  readonly internId: ID;

  @IdField({ nullable: true })
  readonly mentorId?: ID;

  @IdField({ nullable: true })
  readonly countryOfOriginId?: ID;

  @Field(() => InternshipPosition, { nullable: true })
  readonly position?: InternshipPosition;

  @Field(() => [ProductMethodology], { nullable: true })
  readonly methodologies?: ProductMethodology[];

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly growthPlan?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class CreateLanguageEngagementInput {
  @Field()
  @Type(() => CreateLanguageEngagement)
  @ValidateNested()
  readonly engagement: CreateLanguageEngagement;
}

@ObjectType()
export abstract class CreateLanguageEngagementOutput {
  @Field()
  readonly engagement: LanguageEngagement;
}

@InputType()
export abstract class CreateInternshipEngagementInput {
  @Field()
  @Type(() => CreateInternshipEngagement)
  @ValidateNested()
  readonly engagement: CreateInternshipEngagement;
}

@ObjectType()
export abstract class CreateInternshipEngagementOutput {
  @Field()
  readonly engagement: InternshipEngagement;
}

@InputType()
export abstract class EngagementConsistencyInput {
  @Field({
    description: 'engagement type',
  })
  readonly baseNode: string;
}
