import { ProjectWorkflow } from '../../../project/workflow/project-workflow';
import {
  inherit,
  member,
  Policy,
  Role,
  sensMediumOrLower,
  sensOnlyLow,
} from '../util';

export const projectTransitions = () =>
  ProjectWorkflow.pickNames(
    'Pending Financial Endorsement -> Finalizing Proposal With Financial Endorsement',
    'Pending Financial Endorsement -> Finalizing Proposal Without Financial Endorsement',
    'Finalizing Completion -> Back To Active',
    'Finalizing Completion -> Completed',
  );

// NOTE: There could be other permissions for this role from other policies
@Policy(
  [Role.FinancialAnalyst, Role.LeadFinancialAnalyst, Role.Controller],
  (r) => [
    r.Budget.read.when(member).edit,
    r.BudgetRecord.read.when(member).edit,
    r.Ceremony.read,
    r.Directory.read.when(member).edit,
    r.Education.read,
    inherit(
      r.Engagement.when(member).specifically((p) => [
        p.many('disbursementCompleteDate', 'status').edit,
      ]),
      r.LanguageEngagement.specifically((p) => p.paratextRegistryId.none),
    ),
    r.FieldRegion.read,
    r.FieldZone.read,
    r.FinancialReport.edit,
    r.FundingAccount.read,
    r.Language.read.specifically((p) => [
      p.locations.when(sensOnlyLow).read,
      p.many('registryOfDialectsCode', 'signLanguageCode').none,
    ]),
    r.Organization.read.create.whenAny(member, sensMediumOrLower).edit,
    r.Partner.read.create
      .specifically((p) => [
        p.many('pointOfContact').whenAny(member, sensMediumOrLower).read,
      ])
      .children((c) => c.posts.edit),
    r.Partnership.read
      .specifically((p) => [
        p.many('organization', 'partner').whenAny(member, sensMediumOrLower)
          .read,
      ])
      .when(member).edit.create.delete,
    r.Product.read,
    r.Project.read
      .specifically((p) => [
        p
          .many('rootDirectory', 'primaryLocation', 'otherLocations')
          .whenAny(member, sensMediumOrLower).read,
        p
          .many(
            'step',
            'mouStart',
            'mouEnd',
            'rootDirectory',
            'financialReportPeriod',
            'financialReportReceivedAt',
          )
          .read.when(member).edit,
      ])
      .children((c) => c.posts.edit),
    r.ProjectMember.read.when(member).edit.create.delete,
    r.ProjectWorkflowEvent.read.whenAll(
      member,
      r.ProjectWorkflowEvent.isTransitions(projectTransitions),
    ).execute,
    r.PeriodicReport.read.when(member).edit,
    r.StepProgress.read,
    r.Unavailability.read,
    r.User.read.create,
  ],
)
export class FinancialAnalystPolicy {}
