import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.ExperienceOperations, (r) => [
  r.EthnologueLanguage.read,
  r.Language.read,
  r.Organization.whenAny(sensMediumOrLower).read.specifically((p) => [
    p.address.none,
  ]),
  r.Partner.when(sensMediumOrLower)
    .read.when(member)
    .read.specifically((p) => p.many('pmcEntityCode', 'pointOfContact').none)
    .children((c) => c.posts.edit),
  r.Partnership.read,
  r.PeriodicReport.read,
  r.Project.read.specifically((p) => [p.marketingLocation.edit]),
  r.ProjectMember.edit.create.delete,
])
export class ExperienceOperationsPolicy {}
