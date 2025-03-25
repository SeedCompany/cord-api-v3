import { field, Policy, Role } from '../util';

@Policy(Role.MultiplicationFinanceApprover, (r) => [
  r.ProjectWorkflowEvent.read.whenAll(
    field('project.type', 'MultiplicationTranslation', 'Multiplication'),
    r.ProjectWorkflowEvent.isTransitions('Finance Approves Proposal'),
  ).execute,
])
export class MultiplicationFinanceApproverPolicy {}
