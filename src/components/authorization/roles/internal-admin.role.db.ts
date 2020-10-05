import { DbProject } from '../../project/model';
import { Powers } from '../dto/powers';
import { DbBaseNodeGrant, DbRole } from '../model';

// turned off prettier for role files to prevent auto-format making this file huge

const read = true;
const write = true;

export const InternalAdminRole = new DbRole({
  name: 'InternalAdmin',
  powers: [Powers.CreateBudget],
  grants: [
    new DbBaseNodeGrant<DbProject>([
      { propertyName: 'estimatedSubmission',        permission: { read, write, }, },
      { propertyName: 'step',                       permission: { read, write, }, },
      { propertyName: 'name',                       permission: { read, write, }, },
      { propertyName: 'status',                     permission: { read, write, }, },
      { propertyName: 'departmentId',               permission: { read, write, }, },
      { propertyName: 'mouStart',                   permission: { read, write, }, },
      { propertyName: 'mouEnd',                     permission: { read, write, }, },
      { propertyName: 'rootDirectory',              permission: { read, write, }, },
      { propertyName: 'member',                     permission: { read, write, }, },
      { propertyName: 'otherLocations',             permission: { read, write, }, },
      { propertyName: 'primaryLocation',            permission: { read, write, }, },
      { propertyName: 'marketingLocation',          permission: { read, write, }, },
      { propertyName: 'partnership',                permission: { read, write, }, },
      { propertyName: 'budget',                     permission: { read, write, }, },
      { propertyName: 'modifiedAt',                 permission: { read, write, }, },
      { propertyName: 'fieldRegion',                permission: { read, write, }, },
      { propertyName: 'engagement',                 permission: { read, write, }, },
      { propertyName: 'sensitivity',                permission: { read, write, }, },
    ]),
  ],
});
