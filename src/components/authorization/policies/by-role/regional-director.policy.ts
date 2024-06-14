import { member, Policy, Role, sensMediumOrLower } from '../util';
import * as PM from './project-manager.policy';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.RegionalDirector, Role.FieldOperationsDirector], (r) => [
  Role.assignable(r, [Role.ProjectManager]),

  r.Partnership.read,
  r.Project.when(member).edit.specifically(
    (p) => p.rootDirectory.edit.when(sensMediumOrLower).read,
  ),
  r.ProjectWorkflowEvent.transitions(PM.projectTransitions).execute,
  r.ProjectWorkflowEvent.read.transitions(
    'Early Conversations -> Pending Finance Confirmation',
    'Pending Concept Approval -> Prep for Consultant Endorsement',
    'Pending Concept Approval -> Early Conversations',
    'Pending Concept Approval -> Rejected',
    'Pending Regional Director Approval -> Early Conversations',
    'Pending Regional Director Approval -> Pending Finance Confirmation',
    'Pending Regional Director Approval -> Pending Zone Director Approval',
    'Pending Regional Director Approval -> Finalizing Proposal',
    'Pending Regional Director Approval -> Did Not Develop',
    'Pending Regional Director Approval -> Rejected',
    'Pending Suspension Approval -> Discussing Suspension',
    'Pending Suspension Approval -> Suspended',
    'Pending Suspension Approval -> Back To Active',
    'Pending Reactivation Approval -> Active Changed Plan',
    'Pending Reactivation Approval -> Discussing Reactivation',
    'Pending Reactivation Approval -> Discussing Termination',
    'Pending Termination Approval -> Terminated',
    'Pending Termination Approval -> Discussing Termination',
    'Pending Termination Approval -> Back To Most Recent',
  ).execute,
])
export class RegionalDirectorPolicy {}
