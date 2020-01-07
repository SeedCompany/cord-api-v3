import { DateTime } from 'luxon';
import { Location } from '../../location';
import { ProductMethodology } from '../../product';
import { User } from '../../user';
import { InternshipEngagementPosition } from './position';
import { InternshipEngagementStatus } from './status';
import { InternshipEngagementTag } from './tag';

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
