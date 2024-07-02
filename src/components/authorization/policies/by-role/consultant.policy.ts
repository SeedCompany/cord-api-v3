import { ProjectWorkflow } from '../../../project/workflow/project-workflow';
import { member, Policy, Role } from '../util';

export const projectTransitions = () =>
  ProjectWorkflow.pickNames(
    'Consultant Endorses Proposal',
    'Consultant Opposes Proposal',
  );

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.Consultant, Role.ConsultantManager], (r) => [
  [
    r.Ceremony,
    r.Engagement,
    r.EthnologueLanguage,
    r.Language,
    r.Organization,
    r.Partner,
    r.Partnership,
    r.Product,
    r.Project,
    r.ProjectMember,
    r.PeriodicReport,
    r.ProgressReportCommunityStory,
    r.ProgressReportHighlight,
    r.ProgressReportTeamNews,
    r.ProgressReportMedia,
    r.ProgressReportVarianceExplanation,
    r.StepProgress,
  ].map((it) => it.when(member).read),

  r.InternshipEngagement.when(member).edit.specifically((p) => [
    p.ceremony.none,
  ]),
  r.LanguageEngagement.when(member).read.specifically((p) => [
    p.many('pnp', 'paratextRegistryId').edit,
  ]),
  r.FieldRegion.read,
  r.FieldZone.read,
  r.NarrativeReport.when(member).edit.create,
  r.Organization.specifically((p) => p.address.none),
  r.Partner.specifically((p) => p.pointOfContact.none),
  r.Project.when(member).specifically((p) => p.rootDirectory.edit),
  r.Unavailability.read,
  r.User.read.create,
  r.ProjectWorkflowEvent.read.whenAll(
    member,
    r.ProjectWorkflowEvent.isTransitions(projectTransitions),
  ).execute,
])
export class ConsultantPolicy {}
