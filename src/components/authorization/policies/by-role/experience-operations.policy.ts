import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.ExperienceOperations, (r) => [
  r.EthnologueLanguage.read,
  r.Language.read,
  r.Organization.whenAny(sensMediumOrLower).read.specifically((p) => [
    //TODO - this none can be removed when policy executor is refactored to check for address.none in parent policy
    p.address.none,
  ]),
  r.Partner.when(sensMediumOrLower)
    .read.when(member)
    .read.specifically((p) => p.many('pmcEntityCode', 'pointOfContact').none)
    .children((c) => c.posts.edit),
  r.Partnership.read,
  r.PeriodicReport.read,
  r.Project.children((c) => c.posts.when(member).edit),
  r.ProjectMember.edit.create.delete,
])
export class ExperienceOperationsPolicy {}
