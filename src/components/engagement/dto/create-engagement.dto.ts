import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField } from '../../../common';
import { ProductMethodology } from '../../product/dto';
import { InternshipEngagement, LanguageEngagement } from './engagement.dto';
import { InternPosition } from './intern-position.enum';

@InputType({
  isAbstract: true,
})
export abstract class CreateEngagement {
  @Field(() => ID)
  readonly projectId: string;

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
export abstract class CreateLanguageEngagement extends CreateEngagement {
  @Field(() => ID)
  readonly languageId: string;

  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;

  @Field({ nullable: true })
  readonly paraTextRegistryId?: string;
}

@InputType()
export abstract class CreateInternshipEngagement extends CreateEngagement {
  @Field(() => ID)
  readonly internId: string;

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
