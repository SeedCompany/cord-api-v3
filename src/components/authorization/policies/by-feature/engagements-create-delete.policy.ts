import { Hierarchies, member, Policy } from '../util';

@Policy([...Hierarchies.Field, ...Hierarchies.Finance], (r) => [
  r.Project,
  r.Engagement.read,
  r.Engagement.when(member).create,
  r.Engagement.when(member).delete,
])
export class EngagementsCreateDeletePolicy {}
