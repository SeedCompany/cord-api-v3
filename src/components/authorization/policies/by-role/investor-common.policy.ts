import {
  inherit,
  member,
  Policy,
  Role,
  sensMediumOrLower,
  sensOnlyLow,
} from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.Marketing, Role.Fundraising, Role.ExperienceOperations], (r) => [
  r.Budget.read,
  r.BudgetRecord.read,
  r.Ceremony.read,
  r.Education.read,
  inherit(
    r.Engagement.read,
    r.LanguageEngagement.specifically((p) => [p.paratextRegistryId.none])
  ),
  r.EthnologueLanguage.when(sensOnlyLow).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.Language.read.specifically((p) => [
    p.registryOfDialectsCode.when(sensOnlyLow).read,
    p.signLanguageCode.when(sensOnlyLow).read,
    p.locations.whenAny(member, sensOnlyLow).read,
  ]),
  r.Location.read,
  r.Partnership.read.specifically((p) => [
    // TODO this is same as above. Inherit single relation perms automatically. Only read action I guess
    p.many('organization', 'partner').whenAny(member, sensOnlyLow).read,
  ]),
  r.PeriodicReport.whenAny(member, sensMediumOrLower).read,
  r.Product.read,
  r.Project.children((c) => c.posts.when(member).edit),
  r.ProjectMember.read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read,
])
export class InvestorCommonPolicy {}
