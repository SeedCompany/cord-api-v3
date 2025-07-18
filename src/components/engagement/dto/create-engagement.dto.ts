import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { entries } from '@seedcompany/common';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import {
  CalendarDate,
  DataObject,
  DateField,
  type ID,
  IdField,
} from '~/common';
import { ChangesetIdField } from '../../changeset';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { LanguageMilestone } from '../../language/dto';
import { AIAssistedTranslation } from '../../language/dto/ai-assisted-translation.enum';
import { ProductMethodology } from '../../product/dto';
import { InternshipEngagement, LanguageEngagement } from './engagement.dto';
import { InternshipPosition } from './intern-position.enum';
import { EngagementStatus } from './status.enum';

@InputType({
  isAbstract: true,
})
export abstract class CreateEngagement extends DataObject {
  @IdField()
  readonly projectId: ID;

  @DateField({ nullable: true })
  readonly completeDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly disbursementCompleteDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly startDateOverride?: CalendarDate;

  @DateField({ nullable: true })
  readonly endDateOverride?: CalendarDate;

  @Field(() => EngagementStatus, { nullable: true })
  readonly status?: EngagementStatus;
}

@InputType()
export class CreateLanguageEngagement extends CreateEngagement {
  // Warning: this only works if not doing inheritance type mapping
  static readonly Props = entries(
    CreateLanguageEngagement.defaultValue(CreateLanguageEngagement),
  ).map(([k]) => k);

  @IdField()
  readonly languageId: ID;

  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;

  @Field({ nullable: true })
  readonly openToInvestorVisit?: boolean;

  @Field({ nullable: true })
  readonly paratextRegistryId?: string;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly pnp?: CreateDefinedFileVersionInput;

  @Field(() => ProductMethodology, {
    nullable: true,
    description: stripIndent`
      This is the methodology that will be set on products extracted out of the pnp.
      Only a subset is supported here.
      Required to create products when uploading \`pnp\`.
    `,
  })
  readonly methodology?: ProductMethodology;

  @Field({ nullable: true })
  readonly historicGoal?: string;

  @Field(() => LanguageMilestone, { nullable: true })
  readonly milestoneReached?: LanguageMilestone;

  @Field(() => AIAssistedTranslation, { nullable: true })
  readonly usingAIAssistedTranslation?: AIAssistedTranslation;
}

@InputType()
export class CreateInternshipEngagement extends CreateEngagement {
  // Warning: this only works if not doing inheritance type mapping
  static readonly Props = entries(
    CreateInternshipEngagement.defaultValue(CreateInternshipEngagement),
  ).map(([k]) => k);

  @IdField()
  readonly internId: ID;

  @IdField({ nullable: true })
  readonly mentorId?: ID;

  @IdField({ nullable: true })
  readonly countryOfOriginId?: ID;

  @Field(() => InternshipPosition, { nullable: true })
  readonly position?: InternshipPosition;

  @Field(() => [ProductMethodology], { nullable: true })
  readonly methodologies?: readonly ProductMethodology[];

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly growthPlan?: CreateDefinedFileVersionInput;
}

@InputType()
export abstract class CreateLanguageEngagementInput {
  @ChangesetIdField()
  readonly changeset?: ID;

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
  @ChangesetIdField()
  readonly changeset?: ID;

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
