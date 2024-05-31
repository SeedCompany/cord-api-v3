import { takeWhile } from 'lodash';
import { ProjectStep } from '../../../project/dto';
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
      r.LanguageEngagement.specifically((p) => [
        p.paratextRegistryId.when(member).read,
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
    r.ProjectWorkflowEvent.read.transitions(
      'Early Conversations -> Pending Regional Director Approval',
      'Early Conversations -> Pending Finance Confirmation',
      'Early Conversations -> Pending Concept Approval',
      'Early Conversations -> Did Not Develop',
      'Prep for Consultant Endorsement -> Pending Consultant Endorsement',
      'Prep for Consultant & Financial Endorsement & Finalizing Proposal -> Pending Concept Approval',
      'Prep for Consultant & Financial Endorsement & Finalizing Proposal -> Did Not Develop',
      'Pending Consultant Endorsement -> Prep for Financial Endorsement With Consultant Endorsement',
      'Pending Consultant Endorsement -> Prep for Financial Endorsement Without Consultant Endorsement',
      'Prep for Financial Endorsement -> Pending Financial Endorsement',
      'Prep for Financial Endorsement & Finalizing Proposal -> Pending Consultant Endorsement',
      'Finalizing Proposal -> Pending Regional Director Approval',
      'Finalizing Proposal -> Pending Financial Endorsement',
      'Active -> Discussing Change To Plan',
      'Active -> Discussing Termination',
      'Active -> Finalizing Completion',
      'Discussing Change To Plan -> Pending Change To Plan Approval',
      'Discussing Change To Plan -> Discussing Suspension',
      'Discussing Change To Plan -> Back To Active',
      'Pending Change To Plan Approval -> Discussing Change To Plan',
      'Pending Change To Plan Approval -> Pending Change To Plan Confirmation',
      'Pending Change To Plan Approval -> Back To Active',
      'Discussing Suspension -> Pending Suspension Approval',
      'Discussing Suspension -> Back To Active',
      'Suspended -> Discussing Reactivation',
      'Suspended & Discussing Reactivation -> Discussing Termination',
      'Discussing Reactivation -> Pending Reactivation Approval',
      'Discussing Termination -> Pending Termination Approval',
      'Discussing Termination -> Back To Most Recent',
      'Finalizing Completion -> Back To Active',
      'Finalizing Completion -> Completed',
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
