import { Policy, self } from '../util';

@Policy('all', (r) => r.User.when(self).edit)
export class UserCanEditSelfPolicy {}
