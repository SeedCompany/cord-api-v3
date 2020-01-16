import { DateTime } from 'luxon';
import { Language } from '../language/language';
import { ProjectEngagementStatus } from './status';
import { ProjectEngagementTag } from './tag';
import { Product } from '../product/product';
import { ObjectType, InputType, Field, GraphQLISODateTime } from 'type-graphql';

@ObjectType()
@InputType('ProjectEngagementInput')
export class ProjectEngagement {
  @Field({ nullable: true })
  id: string;

  @Field(type => Language, {nullable: true })
  language: Language;

  @Field(type => GraphQLISODateTime,{ nullable: true })
  initialEndDate: DateTime | null;

  @Field(type => GraphQLISODateTime,{ nullable: true })
  currentEndDate: DateTime | null;

  @Field(type => GraphQLISODateTime,{ nullable: true })
  updatedAt: DateTime | null;
}
export interface ProjectEngagement extends EditableProjectEngagement {
  id: string;
  possibleStatuses: ProjectEngagementStatus[];
  language: Language;
  initialEndDate: DateTime | null;
  currentEndDate: DateTime | null;
  updatedAt: DateTime | null;
}

export interface EditableProjectEngagement {
  status: ProjectEngagementStatus;
  products: Product[];
  tags: ProjectEngagementTag[];
  completeDate: DateTime | null;
  disbursementCompleteDate: DateTime | null;
  communicationsCompleteDate: DateTime | null;
  ceremonyEstimatedDate: DateTime | null;
  ceremonyActualDate: DateTime | null;
}
