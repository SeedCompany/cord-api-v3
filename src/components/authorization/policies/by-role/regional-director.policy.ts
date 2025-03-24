import { member, Policy, Role, sensMediumOrLower } from '../util';
import * as PM from './project-manager.policy';

// NOTE: There could be other permissions for this role from other policies
@Policy([Role.RegionalDirector, Role.FieldOperationsDirector], (r) => [
  Role.assignable(r, [Role.ProjectManager]),

  r.Partnership.read,
  r.Project.when(member).edit.specifically(
    (p) => p.rootDirectory.edit.when(sensMediumOrLower).read,
  ),
  r.ProjectWorkflowEvent.transitions(
    PM.projectTransitions,
    PM.momentumProjectsTransitions,
  ).execute,
  r.ProjectWorkflowEvent.read.transitions(
    'Approve Concept',
    'Request Concept Changes',
    'Reject Concept',
    'RD Requests Multiplication Concept Changes',
    'RD Approves Proposal',
    'RD Approves Proposal & Defers to Fields Ops',
    'RD Requests Proposal Changes',
    'RD Ends Development',
    'RD Rejects Proposal',
    'Request Changes for Suspension',
    'Approve Suspension',
    'Reject Suspension',
    'Approve Reactivation',
    'Request Changes for Reactivation',
    'Discussing Terminating Suspended Project By Reactivation Approver',
    'Approve Termination',
    'Request Changes for Termination',
    'End Termination Discussion By Approver',
  ).execute,
])
export class RegionalDirectorPolicy {}
