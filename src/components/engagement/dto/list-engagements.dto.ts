import { Field, InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import {
  Engagement,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
} from './engagement.dto';

@InputType()
export abstract class EngagementFilters {
  @Field({
    description: 'Only engagements matching this type',
    nullable: true,
  })
  readonly type?: 'language' | 'internship';

  readonly projectId?: ID;

  readonly partnerId?: ID;
}

@InputType()
export class EngagementListInput extends SortablePaginationInput<
  keyof Engagement
>({
  defaultSort: 'createdAt',
}) {
  @FilterField(EngagementFilters)
  readonly filter: EngagementFilters;
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
