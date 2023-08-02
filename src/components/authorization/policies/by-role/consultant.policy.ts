import { member, Policy, Role } from '../util';

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
  r.Project.when(member).specifically((p) => [
    p.many('step', 'stepChangedAt', 'rootDirectory').edit,
  ]),
  r.Unavailability.read,
  r.User.read.create,
])
export class ConsultantPolicy {}
