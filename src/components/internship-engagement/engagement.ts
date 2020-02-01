import { DateTime } from 'luxon';
import { DateField } from '../../common';
import { Location } from '../location';
import { InternshipEngagementPosition } from './position';
import { InternshipEngagementStatus } from './status';
import { InternshipEngagementTag } from './tag';
import { User } from '../user';
import { ProductMethodology } from '../product/product-methodology';
import { ObjectType, InputType, Field } from 'type-graphql';

@ObjectType()
@InputType('InternshipEngagementInput')
export class InternshipEngagement {
  @Field()
  id: string;

  intern: User;

  @Field(type => [InternshipEngagementStatus], { nullable: true })
  possibleStatuses: InternshipEngagementStatus[];

  @DateField({ nullable: true })
  initialEndDate: DateTime | null;

  @DateField({ nullable: true })
  currentEndDate: DateTime | null;

  @DateField({ nullable: true })
  updatedAt: DateTime | null;
}

export interface InternshipEngagement extends EditableInternshipEngagement {
  id: string;
  intern: User;
  possibleStatuses: InternshipEngagementStatus[];
  initialEndDate: DateTime | null;
  currentEndDate: DateTime | null;
  updatedAt: DateTime | null;
}

export interface EditableInternshipEngagement {
  status: InternshipEngagementStatus;
  countryOfOrigin: Location | null;
  mentor: User | null;
  position: InternshipEngagementPosition;
  methodologies: ProductMethodology[];
  tags: InternshipEngagementTag[];
  completeDate: DateTime | null;
  disbursementCompleteDate: DateTime | null;
  communicationsCompleteDate: DateTime | null;
  ceremonyEstimatedDate: DateTime | null;
  ceremonyActualDate: DateTime | null;
}
