import { takeWhile } from 'lodash';
import { ProjectStep } from '../../../project/dto';
import { ProjectWorkflow } from '../../../project/workflow/project-workflow';
import {
  action,
  field,
  inherit,
  member,
  Policy,
  Role,
  sensMediumOrLower,
  sensOnlyLow,
  variant,
} from '../util';

// eslint-disable-next-line @seedcompany/no-unused-vars
const stepsUntilFinancialEndorsement = takeWhile(
  [...ProjectStep],
  (s) => s !== ProjectStep.PendingFinancialEndorsement,
);

export const projectTransitions = () =>
  ProjectWorkflow.pickNames(
    // Development
    'Propose Multiplication',
    'Request Concept Approval',
    'End Conversation',
    'Request Consultant Endorsement',
    'Re-request Concept Approval',
    'End Proposal',
    'Request Financial Endorsement',
    'Re-request Consultant Endorsement',
    'Request Proposal Approval',
    'Re-request Financial Endorsement',
    // Allow FPM to submit multiplication project proposals to finance
    // There is only one person, so there is really no external approval needed.
    'RD Proposes Multiplication & Approves',

    // Active on
    'Discuss Change To Plan',
    'Discuss Terminating Active Project',
    'Finalize Completion',
    'Request Change To Plan Approval',
    'Discuss Suspension out of Change to Plan Discussion',
    'End Change To Plan Discussion',
    'Request Changes for Change To Plan',
    'Approve Change To Plan',
    'Reject Change To Plan',
    'Request Suspension Approval',
    'End Suspension Discussion',
    'Discuss Reactivation',
    'Discuss Terminating Suspended Project',
    'Request Reactivation Approval',
    'Request Termination Approval',
    'End Termination Discussion',
    'Not Ready for Completion',
    'Complete',
  );

export const momentumProjectsTransitions = () =>
  ProjectWorkflow.pickNames(
    'Consultant Endorses Proposal',
    'Consultant Opposes Proposal',
  );

// NOTE: There could be other permissions for this role from other policies
@Policy(
  [Role.ProjectManager, Role.RegionalDirector, Role.FieldOperationsDirector],
  (r) => [
    Role.assignable(r, [
      Role.Intern,
      Role.Liaison,
      Role.BibleTranslationLiaison,
      Role.Mentor,
      Role.RegionalCommunicationsCoordinator,
      Role.Translator,
    ]),

    r.Budget.read.when(member).edit,
    r.BudgetRecord.read.whenAll(member, field('status', 'Pending')).edit,
    r.Ceremony.read.when(member).edit,
    r.Education.read.create,
    inherit(
      r.Engagement.when(member).edit.specifically((p) => [
        p.disbursementCompleteDate.read,
      ]),
    ),
    r.EthnologueLanguage.read,
    r.FieldRegion.read,
    r.FieldZone.read,
    r.FundingAccount.read,
    r.Language.read,
    r.Organization.read,
    r.Partner.read
      .specifically((p) => p.pmcEntityCode.none)
      .children((c) => c.posts.read.create),
    r.Partnership.whenAny(
      member,
      sensMediumOrLower,
    ).read.create.delete.specifically((p) => [
      p.many('agreement', 'agreementStatus', 'types', 'partner', 'primary')
        .edit,
    ]),
    r.PeriodicReport.read.when(member).edit,
    r.Producible.edit.create,
    r.Product.read.when(member).edit.create.delete,
    r.ProgressReport.when(member).edit,
    [
      r.ProgressReportCommunityStory,
      r.ProgressReportHighlight,
      r.ProgressReportTeamNews,
    ].flatMap((it) => [
      it.read,
      it.when(member).create,
      it.specifically((p) => [
        p.responses.whenAll(sensOnlyLow, variant('fpm', 'published')).read,
        p.responses.when(member).read,
        p.responses.whenAll(member, variant('draft', 'translated', 'fpm')).edit,
      ]),
    ]),
    [r.ProgressReportMedia].flatMap((it) => [
      it.whenAll(sensOnlyLow, variant('fpm', 'published')).read,
      it.when(member).read,
      it.whenAll(member, variant('draft', 'translated', 'fpm')).create.edit,
    ]),
    r.ProgressReportVarianceExplanation.edit,
    r.ProgressReportWorkflowEvent.read.transitions(
      'Start',
      'In Progress -> In Review',
      'In Progress -> Pending Translation',
      'Translation Done',
      'Translation Reject',
      'Withdraw Review Request',
      'In Review -> Needs Translation',
      'Review Reject',
      'Review Approve',
    ).execute,
    r.ProjectWorkflowEvent.read.whenAll(
      member,
      r.ProjectWorkflowEvent.isTransitions(projectTransitions),
    ).execute,
    // PMs can also endorse for consultant for momentum projects
    r.ProjectWorkflowEvent.whenAll(
      field('project.type', 'MomentumTranslation', 'Momentum'),
      member,
      r.ProjectWorkflowEvent.isTransitions(momentumProjectsTransitions),
    ).execute,
    r.Project.read.create
      .when(member)
      .edit.specifically((p) => [
        p
          .many('rootDirectory', 'otherLocations', 'primaryLocation')
          .edit.whenAny(member, sensMediumOrLower).read,
        p
          .many('mouStart', 'mouEnd')
          .read //
          .whenAll(
            member,
            field('status', 'InDevelopment'),
            // Only allow until financial endorsement
            // field('step', stepsUntilFinancialEndorsement),
          )
          [action]('edit'),
      ])
      .children((c) => c.posts.read.create),
    r.ProjectMember.read.when(member).edit.create.delete,
    [r.StepProgress].flatMap((it) => [
      it.whenAll(member, variant('partner')).read,
      it.whenAll(member, variant('official')).edit,
    ]),
    r.Unavailability.create.read,
    r.User.create.read,
  ],
)
export class ProjectManagerPolicy {}
