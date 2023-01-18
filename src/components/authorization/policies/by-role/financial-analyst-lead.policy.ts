import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.LeadFinancialAnalyst, Role.Controller], (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Engagement.specifically(
    (p) => p.many('disbursementCompleteDate', 'status').edit
  ),
  r.Language.read.specifically((c) => [
    c.locations.whenAny(member, sensMediumOrLower).read,
  ]),
  r.Organization.edit,
  r.Partner.edit,
  r.Partnership.read.create.delete.specifically((p) => [
    p.many('mouStartOverride', 'mouEndOverride', 'mou', 'mouStatus').edit,
  ]),
  r.PeriodicReport.edit,
  r.Project.specifically((p) => [
    p.rootDirectory.read,
    p.many(
      'step',
      'mouStart',
      'mouEnd',
      'rootDirectory',
      'financialReportPeriod',
      'financialReportReceivedAt'
    ).edit,
  ]),
  r.ProjectMember.edit.create.delete,
])
export class FinancialAnalystLeadPolicy {}
