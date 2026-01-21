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
import { CreateDefinedFileVersion } from '../../file/dto';
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
  readonly project: ID<'Project'>;

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
  readonly language: ID<'Language'>;

  @Field({ nullable: true })
  readonly firstScripture?: boolean;

  @Field({ nullable: true })
  readonly lukePartnership?: boolean;

  @Field({ nullable: true })
  readonly openToInvestorVisit?: boolean;

  @Field({ nullable: true })
  readonly paratextRegistryId?: string;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly pnp?: CreateDefinedFileVersion;

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
  readonly milestonePlanned?: LanguageMilestone;

  @Field({ nullable: true })
  readonly milestoneReached?: boolean;

  @Field(() => AIAssistedTranslation, { nullable: true })
  readonly usingAIAssistedTranslation?: AIAssistedTranslation;

  @ChangesetIdField()
  readonly changeset?: ID;
}

@InputType()
export class CreateInternshipEngagement extends CreateEngagement {
  // Warning: this only works if not doing inheritance type mapping
  static readonly Props = entries(
    CreateInternshipEngagement.defaultValue(CreateInternshipEngagement),
  ).map(([k]) => k);

  @IdField()
  readonly intern: ID<'User'>;

  @IdField({ nullable: true })
  readonly mentor?: ID<'User'>;

  @IdField({ nullable: true })
  readonly countryOfOrigin?: ID<'Location'>;

  @Field(() => InternshipPosition, { nullable: true })
  readonly position?: InternshipPosition;

  @Field(() => [ProductMethodology], { nullable: true })
  readonly methodologies?: readonly ProductMethodology[];

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly growthPlan?: CreateDefinedFileVersion;

  @Field(() => Boolean)
  readonly marketable: boolean = false;

  @Field({ nullable: true })
  readonly webId?: string;

  @ChangesetIdField()
  readonly changeset?: ID;
}

@ObjectType()
export abstract class LanguageEngagementCreated {
  @Field()
  readonly engagement: LanguageEngagement;
}

@ObjectType()
export abstract class InternshipEngagementCreated {
  @Field()
  readonly engagement: InternshipEngagement;
}
