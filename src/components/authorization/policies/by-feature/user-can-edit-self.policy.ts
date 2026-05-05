import { Policy, self } from '../util';

@Policy('all', (r) =>
  r.User.when(self).edit.specifically((p) => [
    p.status.none,
    p.roles.none,
    p.organizations.none,
  ]),
)
export class UserCanEditSelfPolicy {}
