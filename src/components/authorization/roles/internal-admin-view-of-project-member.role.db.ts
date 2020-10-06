/* eslint-disable @typescript-eslint/naming-convention */
import {   DbUser } from '../../user/model';
import { DbBaseNodeGrant, DbRole } from '../model';

// do not auto format this file
// turned off prettier for role files to prevent auto-format making this file huge

const read = true;
const write = true;

export const InternalAdminViewOfProjectMemberRole = new DbRole({
  name: 'InternalAdmin',
  powers: [],
  grants: [
    new DbBaseNodeGrant<DbUser>({
      __className: 'DbUser',
      properties: [
        { propertyName: 'displayFirstName',           permission: { read, write, }, },
        { propertyName: 'displayLastName',            permission: { read, write, }, },
        { propertyName: 'email',                      permission: { read, write, }, },
    ]}),

  ],
});
