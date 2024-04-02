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

    r.Budget.read.whenAll(member, field('status', 'Pending')).edit,
    r.BudgetRecord.read.when(member).edit,
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
