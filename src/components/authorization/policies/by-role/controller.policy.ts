import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Controller, (r) => [
  r.Education.read.create,
  r.Engagement.read.create.delete.specifically((p) => [p.status.edit]),
  r.EthnologueLanguage.read,
  r.Organization.create,
  r.Partner.create,
  r.Partnership.edit.create.delete.specifically((p) => [
    p.many(
      'mou',
      'mouEnd',
      'mouEndOverride',
      'mouStart',
      'mouStartOverride',
      'mouStatus'
    ).read, // Maybe flip and explicitly define props with write perms
  ]),
  r.Project.read.specifically((p) => [
    p.many(
      'step',
      'mouStart',
      'mouEnd',
      'stepChangedAt',
      'financialReportPeriod',
      'financialReportReceivedAt'
    ).edit,
  ]),
  r.ProjectMember.edit.create.delete,
])
export class ControllerPolicy {}
