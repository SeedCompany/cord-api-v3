import { DbProject, DbProject2 } from '../../project/model';
import { Powers } from '../dto/powers';
import { DbBaseNodeGrant, DbRole } from '../model';

export const InternalAdminRole = new DbRole({
  name: 'InternalAdmin',
  powers: [Powers.CreateBudget],
  grants: [
    new DbBaseNodeGrant<DbProject>([
      {
        propertyName: 'estimatedSubmission',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'step',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'name',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'status',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'departmentId',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'mouStart',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'mouEnd',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'rootDirectory',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'member',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'otherLocations',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'primaryLocation',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'marketingLocation',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'partnership',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'budget',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'modifiedAt',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'fieldRegion',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'engagement',
        permission: {
          read: true,
          write: true,
        },
      },
      {
        propertyName: 'sensitivity',
        permission: {
          read: true,
          write: true,
        },
      },
    ]),
    new DbBaseNodeGrant<DbProject2>([
      {
        propertyName: 'asdf',
        permission: {
          read: true,
        },
      },
    ]),
  ],
});
