import { inherit, member, Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.Consultant, Role.ConsultantManager], (r) => [
  r.Ceremony.read,
  inherit(
    r.Engagement.read,
    r.InternshipEngagement.when(member).edit.specifically(
      (p) => p.ceremony.none,
    ),
    r.LanguageEngagement.when(member).read.specifically(
      (p) => p.many('pnp', 'paratextRegistryId').edit,
    ),
  ),
  r.EthnologueLanguage.when(member).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.Language.when(member).read,
  r.NarrativeReport.when(member).edit.create,
  r.Organization.when(member).read.specifically((p) => p.address.none),
  r.Partner.when(member).read.specifically((p) => p.pointOfContact.none),
  r.Partnership.when(member).read,
  r.PeriodicReport.read,
  r.Product.read,
  r.ProgressReport.when(member).read.children((c) =>
    [c.teamNews, c.communityStories, c.highlights].flatMap((it) => it.read),
  ),
  r.ProgressReportVarianceExplanation.when(member).read,
  r.ProgressReportTeamNews.read.specifically((p) => p.responses.read),
  r.ProgressReportCommunityStory.read.specifically((p) => p.responses.read),
  r.ProgressReportHighlight.read.specifically((p) => p.responses.read),
  r.Project.when(member).read.specifically(
    (p) => p.many('step', 'stepChangedAt', 'rootDirectory').edit,
  ),
  r.ProjectMember.when(member).read,
  r.StepProgress.read,
  r.Unavailability.read,
  r.User.read.create,
])
export class ConsultantPolicy {}
