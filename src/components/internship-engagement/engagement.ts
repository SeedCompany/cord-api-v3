import { DateTime } from 'luxon';
import { Field, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../common';
import { Location } from '../location';
import { ProductMethodology } from '../product/dto/product-methodology';
import { User } from '../user';
import { InternshipEngagementPosition } from './position';
import { InternshipEngagementStatus } from './status';
import { InternshipEngagementTag } from './tag';

@ObjectType()
@InputType('InternshipEngagementInput')
export class InternshipEngagement {
  @Field()
  id: string;

  intern: User;

  @Field(() => [InternshipEngagementStatus], { nullable: true })
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
