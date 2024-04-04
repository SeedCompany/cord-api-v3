import { field, Hierarchies, member, Policy } from '../util';

@Policy([...Hierarchies.Field, ...Hierarchies.Finance], (r) => [
  r.Project,
  r.Engagement.read,
  r.Engagement.whenAll(member, field('project.status', 'InDevelopment')).create,
  r.Engagement.whenAll(member, field('status', 'InDevelopment')).delete,
])
export class EngagementsCreateDeletePolicy {}
