import { DateTime } from 'luxon';
import { Field, ObjectType } from 'type-graphql';
import { DateField, DateTimeField } from '../../common';
import { Language } from '../language';
import { Product } from '../product/product';
import { ProjectEngagementStatus } from './status';
import { ProjectEngagementTag } from './tag';

@ObjectType()
export class ProjectEngagement {
  @Field({ nullable: true })
  id: string;

  @Field({ nullable: true })
  language: Language;

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;

  @DateTimeField({ nullable: true })
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
