import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  DateFilter,
  FilterField,
  type ID,
  ListField,
  OptionalField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import {
  AIAssistedTranslation,
  LanguageFilters,
  LanguageMilestone,
} from '../../language/dto';
import { ProjectFilters } from '../../project/dto';
import { UserFilters } from '../../user/dto';
import {
  type Engagement,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
} from './engagement.dto';
import { EngagementStatus } from './status.enum';

@InputType()
export abstract class EngagementFilters {
  @OptionalField({
    description: 'Only engagements matching this type',
  })
  readonly type?: 'language' | 'internship';

  @OptionalField({
    description:
      'Only engagements whose project or engaged entity (language / user) name match',
  })
  readonly name?: string;

  @ListField(() => EngagementStatus, {
    optional: true,
    empty: 'omit',
  })
  readonly status?: readonly EngagementStatus[];

  readonly projectId?: ID;
  @FilterField(() => ProjectFilters)
  readonly project?: ProjectFilters & {};

  @OptionalField({
    description:
      'Only engagements whose engaged entity (language / user) name match',
  })
  readonly engagedName?: string;

  readonly languageId?: ID;
  @FilterField(() => LanguageFilters)
  readonly language?: LanguageFilters & {};

  @FilterField(() => UserFilters)
  readonly intern?: UserFilters & {};

  readonly partnerId?: ID<'Partner'>;

  @OptionalField()
  @Type(() => DateFilter)
  @ValidateNested()
  readonly startDate?: DateFilter;

  @OptionalField()
  @Type(() => DateFilter)
  @ValidateNested()
  readonly endDate?: DateFilter;

  @ListField(() => LanguageMilestone, {
    optional: true,
    empty: 'omit',
  })
  readonly milestoneReached?: readonly LanguageMilestone[];

  @ListField(() => AIAssistedTranslation, {
    optional: true,
    empty: 'omit',
  })
  readonly usingAIAssistedTranslation?: readonly AIAssistedTranslation[];
}

@InputType()
export class EngagementListInput extends SortablePaginationInput<
  keyof Engagement
>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => EngagementFilters)
  readonly filter?: EngagementFilters;
}

@ObjectType()
export class EngagementListOutput extends PaginatedList<
  IEngagement,
  Engagement
>(IEngagement, {
  itemsDescription: PaginatedList.itemDescriptionFor('engagements'),
}) {}

@ObjectType()
export class LanguageEngagementListOutput extends PaginatedList(
  LanguageEngagement,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('language engagements'),
  },
) {}

@ObjectType({
  description: SecuredList.descriptionFor('engagements'),
})
export abstract class SecuredEngagementList extends SecuredList<
  IEngagement,
  Engagement
>(IEngagement, {
  itemsDescription: PaginatedList.itemDescriptionFor('engagements'),
}) {}

@ObjectType({
  description: SecuredList.descriptionFor('language engagements'),
})
export abstract class SecuredLanguageEngagementList extends SecuredList(
  LanguageEngagement,
  {
    itemsDescription: PaginatedList.itemDescriptionFor('language engagements'),
  },
) {}

@ObjectType({
  description: SecuredList.descriptionFor('internship engagements'),
})
export abstract class SecuredInternshipEngagementList extends SecuredList(
  InternshipEngagement,
  {
    itemsDescription: PaginatedList.itemDescriptionFor(
      'internship engagements',
    ),
  },
) {}
