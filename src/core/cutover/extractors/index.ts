import { type Extractor } from '../cutover.types';
import { departmentIdBlockExtractor } from './department-id-block.extractor';
import { ethnologueExtractor } from './ethnologue.extractor';
import { fieldRegionExtractor } from './field-region.extractor';
import { fieldZoneExtractor } from './field-zone.extractor';
import { fundingAccountExtractor } from './funding-account.extractor';
import { locationExtractor } from './location.extractor';
import { organizationExtractor } from './organization.extractor';
import { partnerExtractor } from './partner.extractor';
import { toolExtractor } from './tool.extractor';
import { userExtractor } from './user.extractor';

/**
 * All firm-domain extractors, in no particular order — the harness
 * topologically sorts by each extractor's `dependsOn`.
 *
 * Covers the domains already merged to develop. Project / Partnership / File
 * (tree) / and the rest of the waves drop in here as they land (see README.md).
 */
export const extractors: readonly Extractor[] = [
  userExtractor,
  toolExtractor,
  fundingAccountExtractor,
  ethnologueExtractor,
  departmentIdBlockExtractor,
  fieldZoneExtractor,
  fieldRegionExtractor,
  locationExtractor,
  organizationExtractor,
  partnerExtractor,
];
