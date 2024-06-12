import { Policy, Role } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Controller, (r) => [
  // keep multiline format
  r.Organization.delete,
  r.Partner.delete,
  r.ProjectWorkflowEvent.read.transitions(
    'Pending & On Hold Finance Confirmation -> Active',
    'Pending Finance Confirmation -> Pending Regional Director Approval',
    'Pending Finance Confirmation -> Did Not Develop',
    'Pending Finance Confirmation -> On Hold Finance Confirmation',
    'Pending & On Hold Finance Confirmation -> Finalizing Proposal',
    'Pending & On Hold Finance Confirmation -> Rejected',
    'Pending Change To Plan Confirmation -> Discussing Change To Plan',
    'Pending Change To Plan Confirmation -> Active Changed Plan',
    'Pending Change To Plan Confirmation -> Back To Active',
  ).execute,
])
export class ControllerPolicy {}
