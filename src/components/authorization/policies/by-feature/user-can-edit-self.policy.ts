import { owner, Policy } from '../util';

@Policy('all', (r) => r.User.when(owner).edit)
export class UserCanEditSelfPolicy {}
