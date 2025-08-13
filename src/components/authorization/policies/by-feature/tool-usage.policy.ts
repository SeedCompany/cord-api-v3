import { member, Policy, Role } from '../util';

@Policy(
  [
    ...Role.Hierarchies.Field,
    ...Role.Hierarchies.Finance,
    Role.Consultant,
    Role.ConsultantManager,
    Role.Administrator, // Add Administrator for testing
  ],
  (r) => [
    r.ToolUsage.when(member).read.create.edit.delete,
    r.ToolUsage.read, // Add broader read permission for testing
    r.Tool.read,
  ],
)
export class ToolUsagePolicy {}
