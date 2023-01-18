import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.RegionalDirector, Role.FieldOperationsDirector], (r) => [
  Role.assignable(r, [Role.ProjectManager]),

  r.Partnership.read,
  r.Project.when(member).edit.specifically(
    (p) => p.rootDirectory.when(sensMediumOrLower).read
  ),
])
export class RegionalDirectorPolicy {}
