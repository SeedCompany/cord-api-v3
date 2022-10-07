import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.LeadFinancialAnalyst, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Engagement.specifically((p) => p.disbursementCompleteDate.edit),
  r.Language.read.specifically((c) => [
    c.locations.whenAny(member, sensMediumOrLower).read,
  ]),
  r.Organization.edit,
  r.Partner.edit,
  r.Partnership.read.create.delete.specifically((p) => [
    p.many('mouStartOverride', 'mouEndOverride', 'mou', 'mouStatus').edit,
  ]),
  r.Project.specifically((p) => [
    p.rootDirectory.read,
    p.many(
      'estimatedSubmission',
      'step',
      'name',
      'departmentId',
      'mouStart',
      'mouEnd',
      'primaryLocation',
      'marketingLocation',
      'otherLocations'
    ).edit,
  ]),
  r.PeriodicReport.edit,
])
export class FinancialAnalystLeadPolicy {}
