import { any, field, member, Policy, Role } from '../util';

@Policy([...Role.Hierarchies.Field, ...Role.Hierarchies.Finance], (r) => [
  r.Project,
  r.Engagement.read,
  r.Engagement.whenAll(
    member,
    any(
      field('project.status', 'InDevelopment'),
      field('project.step', 'DiscussingChangeToPlan'),
    ),
  ).create,
  r.Engagement.whenAll(member, field('status', 'InDevelopment')).delete,
])
export class EngagementsCreateDeletePolicy {}
