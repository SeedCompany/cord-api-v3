import { ProjectStatus } from '../../project/dto';
import { InternalRole, Role } from '../dto';
import { Perm, policy, policyExecutor } from './policy';

// permissions are the intersection of a role and a base node type.
// each role will have a unique collection of read and write
// permissions on each type of base node.
// the Admin role SHALL have all properties on a base node

const policies = [
  policy('Project', InternalRole.Admin, {
    estimatedSubmission: Perm.ReadAndEdit,
    step: Perm.ReadAndEdit,
    name: Perm.ReadAndEdit,
    // status: Perm.ReadAndEdit,
    departmentId: Perm.ReadAndEdit,
    mouStart: Perm.ReadAndEdit,
    mouEnd: Perm.ReadAndEdit,
    rootDirectory: Perm.Read,
    member: Perm.ReadAndEdit,
    locations: Perm.ReadAndEdit,
    partnership: Perm.ReadAndEdit,
    budget: Perm.ReadAndEdit,
    // modifiedAt: Perm.ReadAndEdit,
  }),
  policy(
    'Project',
    InternalRole.Admin,
    (project) => project.status === ProjectStatus.InDevelopment,
    {
      mouStart: Perm.ReadAndEdit,
      mouEnd: Perm.ReadAndEdit,
    }
  ),
  policy('Project', Role.Translator, {
    mouStart: Perm.Read,
    mouEnd: Perm.Read,
    name: Perm.ReadAndEdit,
  }),
  policy('ProjectMember', InternalRole.Admin, {
    roles: Perm.ReadAndEdit,
    user: Perm.ReadAndEdit,
    // modifiedAt: Perm.ReadAndEdit,
  }),
  policy('User', InternalRole.AdminViewOfProjectMember, {
    displayFirstName: Perm.Read,
    displayLastName: Perm.Read,
    email: Perm.Read,
  }),
];

export const getRolePermissions = policyExecutor(policies);
