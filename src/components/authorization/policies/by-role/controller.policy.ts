import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Controller, (r) => [
  // keep multiline format
  r.Organization.delete,
  r.Partner.delete,
  r.ProjectWorkflowEvent.read.transitions(
    'Finance Approves Proposal',
    'Finance Holds for Confirmation',
    'Finance Requests Proposal Changes',
    'Finance Requests Multiplication Changes',
    'Finance Rejects Proposal',
    'Finance Ends Development',
    'Finance Approves Change To Plan',
    'Finance Requests Changes for Change To Plan',
    'Finance Rejects Change To Plan',
  ).execute,
])
export class ControllerPolicy {}
