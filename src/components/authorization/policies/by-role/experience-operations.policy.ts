import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.ExperienceOperations, (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Education.read,
  r.Engagement.read,
  r.EthnologueLanguage.whenAny(member, sensMediumOrLower).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.FundingAccount.read,
  r.Language.read.specifically((p) => [
    p
      .many('registryOfDialectsCode', 'signLanguageCode', 'locations')
      .whenAny(member, sensMediumOrLower).read,
  ]),
  r.Organization.whenAny(member, sensMediumOrLower).read.specifically((p) => [
    p.address.none,
  ]),
  r.Partner.whenAny(member, sensMediumOrLower)
    .read.specifically((p) => p.pointOfContact.none)
    .children((c) => c.posts.edit),
  r.Partnership.read.specifically((p) => [
    p.many('organization', 'partner').whenAny(member, sensMediumOrLower).read,
  ]),
  r.PeriodicReport.read,
  r.Product.read,
  r.Project.read,
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read,
])
export class ExperienceOperationsPolicy {}
