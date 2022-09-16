import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Controller, (r) => [
  r.Budget.edit,
  r.BudgetRecord.edit,
  r.Ceremony.read,
  r.FileNode.edit.create,
  r.Education.read.create,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Engagement.read.create.delete.specifically((p) => [
    p.disbursementCompleteDate.edit,
    p.status.edit,
  ]),
  r.Language.read.specifically((p) => [
    p.locations.whenAny(member, sensMediumOrLower).read,
  ]),
  r.Location.read,
  r.Organization.edit.create,
  r.Partner.edit.create,
  r.Partnership.edit.create.delete.specifically((p) => [
    p.many(
      'mou',
      'mouEnd',
      'mouEndOverride',
      'mouStart',
      'mouStartOverride',
      'mouStatus'
    ).read, // Maybe flip and explicitly define props with write perms
  ]),
  r.Post.edit,
  r.Producible.read,
  r.Product.read,
  r.Project.read.specifically((p) => [
    p.many(
      'step',
      'mouStart',
      'mouEnd',
      'stepChangedAt',
      'financialReportPeriod',
      'financialReportReceivedAt'
    ).edit,
  ]),
  r.ProjectMember.edit.create.delete,
  r.PeriodicReport.read,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.edit,
  r.StepProgress.read,
])
export class ControllerPolicy {}
