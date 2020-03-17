import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { CalendarDate, DateField } from '../../../common';
import { ProductMethodology } from '../../product/dto';
import { InternshipEngagement, LanguageEngagement } from './engagement.dto';
import { InternPosition } from './intern-position.enum';

@InputType({
  isAbstract: true,
})
export abstract class UpdateEngagement {
  @Field(() => ID)
  readonly id: string;

  @DateField({ nullable: true })
  readonly completeDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly disbursementCompleteDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly communicationsCompleteDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly startDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly endDate?: CalendarDate;
}

@InputType()
export abstract class UpdateLanguageEngagement extends UpdateEngagement {
  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;
}

@InputType()
export abstract class UpdateInternshipEngagement extends UpdateEngagement {
  @Field(() => ID, { nullable: true })
  readonly mentorId?: string;

  @Field(() => ID, { nullable: true })
  readonly countryOfOriginId?: string;

  @Field(() => InternPosition, { nullable: true })
  readonly position?: InternPosition;

  @Field(() => [ProductMethodology], { nullable: true })
  readonly methodologies?: ProductMethodology[];
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
