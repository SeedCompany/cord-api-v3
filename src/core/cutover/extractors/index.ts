import { type Extractor } from '../cutover.types';
import { budgetExtractor } from './budget.extractor';
import { commentExtractor } from './comment.extractor';
import { departmentIdBlockExtractor } from './department-id-block.extractor';
import { engagementExtractor } from './engagement.extractor';
import { ethnologueExtractor } from './ethnologue.extractor';
import { fieldRegionExtractor } from './field-region.extractor';
import { fieldZoneExtractor } from './field-zone.extractor';
import { fileExtractor } from './file.extractor';
import { fundingAccountExtractor } from './funding-account.extractor';
import { knownLanguageExtractor } from './known-language.extractor';
import { languageExtractor } from './language.extractor';
import { locationExtractor } from './location.extractor';
import { mediaExtractor } from './media.extractor';
import { notificationExtractor } from './notification.extractor';
import { organizationExtractor } from './organization.extractor';
import { partnerExtractor } from './partner.extractor';
import { partnershipExtractor } from './partnership.extractor';
import { periodicReportExtractor } from './periodic-report.extractor';
import { pinExtractor } from './pin.extractor';
import { pnpExtractionResultExtractor } from './pnp-extraction-result.extractor';
import { postExtractor } from './post.extractor';
import { productProgressExtractor } from './product-progress.extractor';
import { productExtractor } from './product.extractor';
import { progressReportMediaExtractor } from './progress-report-media.extractor';
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
 * Covers every domain merged to develop, File + Media + PnP included.
 *
 * Still outstanding, and NOT writable here: the four tables that exist only on
 * `pg-app-enablement` — `tool_usages`, `progress_report_workflow_events`,
 * `progress_report_variance_explanations`, `partnership_producing_mediums`. Their
 * schema is not in this branch, so an extractor importing it would not compile.
 *
 * Three tables are intentionally never filled and need no extractor:
 * `auth_sessions` + `auth_password_reset_tokens` (transient — users re-authenticate
 * post-cutover, see README) and `resource_mutations` (the audit log is a
 * Postgres-only surface with no Neo4j counterpart to read; it starts empty and
 * accumulates from the first mutation after the flip).
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
  pinExtractor,
  knownLanguageExtractor,
  commentExtractor,
  postExtractor,
  fileExtractor,
  mediaExtractor,
  pnpExtractionResultExtractor,
  progressReportMediaExtractor,
];
