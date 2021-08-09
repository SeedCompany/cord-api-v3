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
export abstract class UpdateEngagement {
  @IdField()
  readonly id: ID;

  @DateField({ nullable: true })
  readonly completeDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly disbursementCompleteDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly startDateOverride?: CalendarDate;

  @DateField({ nullable: true })
  readonly endDateOverride?: CalendarDate;

  readonly initialEndDate?: CalendarDate | null;

  @Field(() => EngagementStatus, { nullable: true })
  readonly status?: EngagementStatus;
}

@InputType()
export abstract class UpdateLanguageEngagement extends UpdateEngagement {
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
export abstract class UpdateInternshipEngagement extends UpdateEngagement {
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
export abstract class UpdateLanguageEngagementInput {
  @IdField({
    description: 'The change object to associate these engagement changes with',
    nullable: true,
  })
  readonly changeset?: ID;

  @Field()
  @Type(() => UpdateLanguageEngagement)
  @ValidateNested()
  readonly engagement: UpdateLanguageEngagement;
}

@ObjectType()
export abstract class UpdateLanguageEngagementOutput {
  @Field()
  readonly engagement: LanguageEngagement;
}

@InputType()
export abstract class UpdateInternshipEngagementInput {
  @IdField({
    description: 'The change object to associate these engagement changes with',
    nullable: true,
  })
  readonly changeset?: ID;

  @Field()
  @Type(() => UpdateInternshipEngagement)
  @ValidateNested()
  readonly engagement: UpdateInternshipEngagement;
}

@ObjectType()
export abstract class UpdateInternshipEngagementOutput {
  @Field()
  readonly engagement: InternshipEngagement;
}
