import { member, Policy, Role, variant } from '../util';

@Policy(Role.FieldPartner, (r) => [
  r.Ceremony.read,
  r.Engagement.when(member).read,
  r.EthnologueLanguage.when(member).read,
  r.FieldRegion.read,
  r.FieldZone.read,
  r.Language.when(member).read,
  r.Organization.when(member).read.specifically((p) => p.address.none),
  r.Partner.when(member).read.specifically((p) => p.pointOfContact.none),
  r.Partnership.when(member).read,
  r.PeriodicReport.read,
  r.Product.read,
  r.ProgressReport.when(member).read.specifically((p) => p.reportFile.none),
  [
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
  ].flatMap((it) => [
    it.when(member).create.read,
    it.specifically((p) => [
      p.responses.whenAll(member, variant('translated')).read,
      p.responses.whenAll(member, variant('draft')).edit,
    ]),
  ]),
  r.ProgressReportWorkflowEvent.transitions(
    'Start',
    'In Progress -> In Review',
    'In Progress -> Pending Translation',
    'Withdraw Review Request'
  ).execute,
  r.Project.when(member).read.specifically((p) => p.rootDirectory.none),
  r.ProjectMember.when(member).read,
  r.StepProgress.whenAll(member, variant('partner')).edit,
  r.Unavailability.read,
  r.User.read,
])
export class FieldPartnerPolicy {}
