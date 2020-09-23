import { InternalRole, Role } from '../dto';
import { BaseNodeType } from './BaseNodeType';

// permissions are the intersection of a role and a base node type.
// each role will have a unique collection of read and write
// permissions on each type of base node.
// the Admin role SHALL have all properties on a base node

export function getRolePermissions(
  role: Role | InternalRole,
  baseNodeType: BaseNodeType
): {
  read: string[];
  edit: string[];
} {
  if (role === InternalRole.Admin && baseNodeType === BaseNodeType.Project) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: [
        'estimatedSubmission',
        'step',
        'name',
        'status',
        'deptId',
        'mouStart',
        'mouEnd',
        'rootDirectory',
        'member',
        'locations',
        'partnership',
        'budget',
        'modifiedAt',
      ],
    };
  }

  if (
    role === InternalRole.Admin &&
    baseNodeType === BaseNodeType.ProjectMember
  ) {
    return {
      read: [], // since edit will have all props, nothing for read perm
      edit: ['roles', 'member', 'user', 'modifiedAt'],
    };
  }

  if (
    role === InternalRole.AdminViewOfProjectMember &&
    baseNodeType === BaseNodeType.User
  ) {
    return {
      read: ['displayFirstName', 'displayLastName', 'email'],
      edit: [],
    };
  }

  if (role === Role.Translator && baseNodeType === BaseNodeType.Project) {
    return {
      // these were just place holders for testing, not impl yet
      read: ['mouStart', 'mouEnd'],
      edit: ['name'],
    };
  }

  return {
    read: [],
    edit: [],
  };
}
