import { type Extractor } from '../cutover.types';
import { budgetExtractor } from './budget.extractor';
import { departmentIdBlockExtractor } from './department-id-block.extractor';
import { engagementExtractor } from './engagement.extractor';
import { ethnologueExtractor } from './ethnologue.extractor';
import { fieldRegionExtractor } from './field-region.extractor';
import { fieldZoneExtractor } from './field-zone.extractor';
import { fundingAccountExtractor } from './funding-account.extractor';
import { languageExtractor } from './language.extractor';
import { locationExtractor } from './location.extractor';
import { notificationExtractor } from './notification.extractor';
import { organizationExtractor } from './organization.extractor';
import { partnerExtractor } from './partner.extractor';
import { partnershipExtractor } from './partnership.extractor';
import { periodicReportExtractor } from './periodic-report.extractor';
import { productProgressExtractor } from './product-progress.extractor';
import { productExtractor } from './product.extractor';
import { progressSummaryExtractor } from './progress-summary.extractor';
import { projectMemberExtractor } from './project-member.extractor';
import { projectExtractor } from './project.extractor';
import { promptVariantResponseExtractor } from './prompt-variant-response.extractor';
import { toolExtractor } from './tool.extractor';
import { userExtractor } from './user.extractor';

/**
 * All firm-domain extractors, in no particular order — the harness
 * topologically sorts by each extractor's `dependsOn`.
 *
 * Covers the domains already merged to develop. File (tree) / Engagement and
 * the rest of the waves drop in here as they land (see README.md).
 */
export const extractors: readonly Extractor[] = [
  userExtractor,
  toolExtractor,
  fundingAccountExtractor,
  ethnologueExtractor,
  languageExtractor,
  departmentIdBlockExtractor,
  fieldZoneExtractor,
  fieldRegionExtractor,
  locationExtractor,
  organizationExtractor,
  partnerExtractor,
  projectExtractor,
  projectMemberExtractor,
  partnershipExtractor,
  engagementExtractor,
  productExtractor,
  periodicReportExtractor,
  promptVariantResponseExtractor,
  productProgressExtractor,
  progressSummaryExtractor,
  notificationExtractor,
  budgetExtractor,
];
