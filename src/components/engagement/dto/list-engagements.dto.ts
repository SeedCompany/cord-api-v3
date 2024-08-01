import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { LanguageFilters } from '../../language/dto';
import { ProjectFilters } from '../../project/dto';
import { UserFilters } from '../../user/dto';
import {
  Engagement,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
} from './engagement.dto';
import { EngagementStatus } from './status.enum';

@InputType()
export abstract class EngagementFilters {
  @Field({
    description: 'Only engagements matching this type',
    nullable: true,
  })
  readonly type?: 'language' | 'internship';

  @Field({
    nullable: true,
    description:
      'Only engagements whose project or engaged entity (language / user) name match',
  })
  readonly name?: string;

  @Field(() => [EngagementStatus], {
    nullable: true,
  })
  readonly status?: readonly EngagementStatus[];

  readonly projectId?: ID;
  @FilterField(() => ProjectFilters)
  readonly project?: ProjectFilters & {};

  @Field({
    nullable: true,
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
