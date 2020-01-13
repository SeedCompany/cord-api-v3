import { DateTime } from 'luxon';
import { Language } from '../language/language';

import { ProjectEngagementStatus } from './status';
import { ProjectEngagementTag } from './tag';
import { Product } from '../product/product';

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
