import { Policy, Role, sensOnlyLow } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.StaffMember, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.FileNode.read,
  r.Education.read,
  r.EthnologueLanguage.read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.Producible.read,
  r.FundingAccount.read,
  r.Engagement.read,
  r.Language.read.specifically((p) => p.locations.when(sensOnlyLow).read),
  r.Location.read,
  r.Organization.when(sensOnlyLow).read.specifically((p) => p.address.none),
  r.Partner.when(sensOnlyLow)
    .read.specifically((p) => [p.pointOfContact.none, p.pmcEntityCode.none])
    .children((c) => c.posts.edit),
  r.Partnership.read.specifically((p) => p.partner.when(sensOnlyLow).read),
  r.Post.read,
  r.Product.read,
  r.Project.read
    .specifically((p) => [
      p.rootDirectory.none,
      p.many('otherLocations', 'primaryLocation').when(sensOnlyLow).read,
    ])
    .children((c) => c.posts.edit),
  r.ProjectMember.read,
  r.PeriodicReport.edit,
  r.User.read,
  r.Unavailability.read,
  r.ProjectChangeRequest.read,
  r.StepProgress.read,
])
export class StaffMemberPolicy {}
