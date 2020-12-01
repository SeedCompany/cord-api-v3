import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, IdField } from '../../../common';
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
  readonly id: string;

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

  readonly initialEndDate?: CalendarDate;

  @Field(() => EngagementStatus, { nullable: true })
  readonly status?: EngagementStatus;
}

@InputType()
export abstract class UpdateLanguageEngagement extends UpdateEngagement {
  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;

  @Field({
    deprecationReason: 'Not proper case',
    nullable: true,
  })
  readonly paraTextRegistryId?: string;

  @Field({ nullable: true })
  readonly paratextRegistryId?: string;

  @Field({ nullable: true })
  readonly pnp?: CreateDefinedFileVersionInput;

  @Field({ nullable: true })
  readonly historicGoal?: string;
}

@InputType()
export abstract class UpdateInternshipEngagement extends UpdateEngagement {
  @IdField({ nullable: true })
  readonly mentorId?: string;

  @IdField({ nullable: true })
  readonly countryOfOriginId?: string;

  @Field(() => InternshipPosition, { nullable: true })
  readonly position?: InternshipPosition;

  @Field(() => [ProductMethodology], { nullable: true })
  readonly methodologies?: ProductMethodology[];

  @Field({ nullable: true })
  readonly growthPlan?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class UpdateLanguageEngagementInput {
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
