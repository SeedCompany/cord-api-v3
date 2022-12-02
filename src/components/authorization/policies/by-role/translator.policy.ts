import { member, Policy, Role, variant } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Translator, (r) => [
  r.Ceremony.when(member).read,
  r.Engagement.when(member).read,
  r.EthnologueLanguage.when(member).read,
  r.Language.when(member).read.specifically(
    (p) =>
      p.many('leastOfThese', 'leastOfTheseReason', 'sponsorEstimatedEndDate')
        .none
  ),
  r.Location.when(member).read.specifically(
    (p) => p.many('fundingAccount').none
  ),
  r.Partnership.when(member).specifically(
    (p) => p.many('organization', 'partner', 'types').read
  ),
  r.Product.read,
  r.ProgressReport.when(member).edit,
  r.ProgressReportCommunityStory.when(member).read.specifically((p) => [
    p.responses.whenAll(member, variant('draft')).read,
    p.responses.whenAll(member, variant('translated')).edit,
  ]),
  r.ProgressReportHighlight.when(member).read.specifically((p) => [
    p.responses.whenAll(member, variant('draft')).read,
    p.responses.whenAll(member, variant('translated')).edit,
  ]),
  r.Project.when(member)
    .read.specifically((p) => [
      p.rootDirectory.edit,
      p.many('departmentId', 'marketingLocation', 'fieldRegion').none,
    ])
    .children((c) => c.posts.edit),
  r.ProjectMember.when(member).read,
  r.PeriodicReport.when(member).read,
])
export class TranslatorPolicy {}
