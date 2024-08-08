import { member, Policy, Role, sensMediumOrLower } from '../util';
import * as FA from './financial-analyst.policy';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.LeadFinancialAnalyst, Role.Controller], (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Engagement.specifically(
    (p) => p.many('disbursementCompleteDate', 'status').edit,
  ),
  r.Language.read.specifically((c) => [
    c.locations.whenAny(member, sensMediumOrLower).read,
  ]),
  r.Organization.edit,
  r.Partner.edit,
  r.Partnership.read.create.delete.specifically((p) => [
    p.many(
      'mouStartOverride',
      'mouEndOverride',
      'mou',
      'mouStatus',
      'financialReportingType',
      'primary',
      'types',
    ).edit,
  ]),
  r.PeriodicReport.edit,
  r.Project.specifically((p) => [
    p.many('primaryLocation', 'rootDirectory').read,
    p.many(
      'step',
      'mouStart',
      'mouEnd',
      'rootDirectory',
      'financialReportPeriod',
      'financialReportReceivedAt',
    ).edit,
  ]),
  r.ProjectWorkflowEvent.transitions(FA.projectTransitions).execute,
  r.EngagementWorkflowEvent.transitions(FA.engagementTransitions).execute,
  r.ProjectMember.edit.create.delete,
])
export class FinancialAnalystLeadPolicy {}
