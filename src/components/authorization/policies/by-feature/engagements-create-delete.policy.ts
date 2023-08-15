import { Hierarchies, member, Policy, status } from '../util';

@Policy([...Hierarchies.Field, ...Hierarchies.Finance], (r) => [
  r.Project,
  r.Engagement.read,
  r.Engagement.when(member).create,
  r.Engagement.whenAll(member, status('InDevelopment')).delete,
])
export class EngagementsCreateDeletePolicy {}
