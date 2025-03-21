import type { $ } from 'gel';
import type { ID } from '~/common/id-field';
import type { TypedEdgeQL } from '../edgeql';

export interface InlineQueryMap {
  /** {@link import('src/components/progress-report/workflow/progress-report-workflow.gel.repository.ts')} L55 */
  [`
      with report := <ProgressReport><uuid>$reportId,
      users := (select report.project.members.user filter exists .email)
      select users { id, email := assert_exists(.email), roles }
    `]: TypedEdgeQL<{
      readonly "reportId": ID;
    }, ReadonlyArray<{
      readonly "id": ID;
      readonly "email": string;
      readonly "roles": ReadonlyArray<("Administrator" | "BetaTester" | "BibleTranslationLiaison" | "Consultant" | "ConsultantManager" | "Controller" | "ExperienceOperations" | "FieldOperationsDirector" | "FieldPartner" | "FinancialAnalyst" | "Fundraising" | "Intern" | "LeadFinancialAnalyst" | "Leadership" | "Liaison" | "Marketing" | "Mentor" | "ProjectManager" | "RegionalCommunicationsCoordinator" | "RegionalDirector" | "StaffMember" | "Translator")>;
    }>>;

  /** {@link import('src/components/progress-report/workflow/progress-report-workflow.gel.repository.ts')} L64 */
  [`
      with emails := array_unpack(<array<str>>$emails),
      users := (select User filter .email in emails)
      select users { id, email := assert_exists(.email) }
    `]: TypedEdgeQL<{
      readonly "emails": ReadonlyArray<string>;
    }, ReadonlyArray<{
      readonly "id": ID;
      readonly "email": string;
    }>>;

  /** {@link import('src/components/user/queries/hydrateUsers.ts')} L5 */
  [`
select User {
  id,
}`]: TypedEdgeQL<null, ReadonlyArray<{
      readonly "id": ID;
    }>>;

  /** {@link import('src/components/user/queries/hydrateUsers.ts')} L10 */
  [`select User::Education {
  id,
}`]: TypedEdgeQL<null, ReadonlyArray<{
      readonly "id": ID;
    }>>;

  /** {@link import('src/components/user/system-agent.gel.repository.ts')} L15 */
  [`
      select (
        (select SystemAgent filter .name = <str>$name) ??
        (insert SystemAgent {
          name := <str>$name,
          roles := array_unpack(<optional array<Role>>$roles)
        })
      ) {*}
    `]: TypedEdgeQL<{
      readonly "name": string;
      readonly "roles"?: ReadonlyArray<("Administrator" | "BetaTester" | "BibleTranslationLiaison" | "Consultant" | "ConsultantManager" | "Controller" | "ExperienceOperations" | "FieldOperationsDirector" | "FieldPartner" | "FinancialAnalyst" | "Fundraising" | "Intern" | "LeadFinancialAnalyst" | "Leadership" | "Liaison" | "Marketing" | "Mentor" | "ProjectManager" | "RegionalCommunicationsCoordinator" | "RegionalDirector" | "StaffMember" | "Translator")> | null;
    }, {
      readonly "id": ID;
      readonly "roles": ReadonlyArray<("Administrator" | "BetaTester" | "BibleTranslationLiaison" | "Consultant" | "ConsultantManager" | "Controller" | "ExperienceOperations" | "FieldOperationsDirector" | "FieldPartner" | "FinancialAnalyst" | "Fundraising" | "Intern" | "LeadFinancialAnalyst" | "Leadership" | "Liaison" | "Marketing" | "Mentor" | "ProjectManager" | "RegionalCommunicationsCoordinator" | "RegionalDirector" | "StaffMember" | "Translator")>;
      readonly "name": string;
    }>;

  /** {@link import('src/components/project/workflow/project-workflow.repository.ts')} L53 */
  [`
      with
       project := <Project><uuid>$projectId,
       steps := array_unpack(<array<Project::Step>>$steps),
       mostRecentEvent := (
        select project.workflowEvents
        filter .to in steps if exists steps else true
        order by .at desc
        limit 1
      )
      select mostRecentEvent.to
    `]: TypedEdgeQL<{
      readonly "projectId": ID;
      readonly "steps": ReadonlyArray<("EarlyConversations" | "PendingConceptApproval" | "PrepForConsultantEndorsement" | "PendingConsultantEndorsement" | "PrepForFinancialEndorsement" | "PendingFinancialEndorsement" | "FinalizingProposal" | "PendingRegionalDirectorApproval" | "PendingZoneDirectorApproval" | "PendingFinanceConfirmation" | "OnHoldFinanceConfirmation" | "DidNotDevelop" | "Rejected" | "Active" | "ActiveChangedPlan" | "DiscussingChangeToPlan" | "PendingChangeToPlanApproval" | "PendingChangeToPlanConfirmation" | "DiscussingSuspension" | "PendingSuspensionApproval" | "Suspended" | "DiscussingReactivation" | "PendingReactivationApproval" | "DiscussingTermination" | "PendingTerminationApproval" | "FinalizingCompletion" | "Terminated" | "Completed")>;
    }, ("EarlyConversations" | "PendingConceptApproval" | "PrepForConsultantEndorsement" | "PendingConsultantEndorsement" | "PrepForFinancialEndorsement" | "PendingFinancialEndorsement" | "FinalizingProposal" | "PendingRegionalDirectorApproval" | "PendingZoneDirectorApproval" | "PendingFinanceConfirmation" | "OnHoldFinanceConfirmation" | "DidNotDevelop" | "Rejected" | "Active" | "ActiveChangedPlan" | "DiscussingChangeToPlan" | "PendingChangeToPlanApproval" | "PendingChangeToPlanConfirmation" | "DiscussingSuspension" | "PendingSuspensionApproval" | "Suspended" | "DiscussingReactivation" | "PendingReactivationApproval" | "DiscussingTermination" | "PendingTerminationApproval" | "FinalizingCompletion" | "Terminated" | "Completed") | null>;
}

export const InlineQueryRuntimeMap = new Map<string, { query: string, cardinality: `${$.Cardinality}` }>([
    [
      "with report := <ProgressReport><uuid>$reportId,\nusers := (select report.project.members.user filter exists .email)\nselect users { id, email := assert_exists(.email), roles }",
      {
        "query": "\n      with report := <ProgressReport><uuid>$reportId,\n      users := (select report.project.members.user filter exists .email)\n      select users { id, email := assert_exists(.email), roles }\n    ",
        "cardinality": "Many"
      }
    ],
    [
      "with emails := array_unpack(<array<str>>$emails),\nusers := (select User filter .email in emails)\nselect users { id, email := assert_exists(.email) }",
      {
        "query": "\n      with emails := array_unpack(<array<str>>$emails),\n      users := (select User filter .email in emails)\n      select users { id, email := assert_exists(.email) }\n    ",
        "cardinality": "Many"
      }
    ],
    [
      "select User {\n  id,\n}",
      {
        "query": "\nselect User {\n  id,\n}",
        "cardinality": "Many"
      }
    ],
    [
      "select User::Education {\n  id,\n}",
      {
        "query": "select User::Education {\n  id,\n}",
        "cardinality": "Many"
      }
    ],
    [
      "select (\n  (select SystemAgent filter .name = <str>$name) ??\n  (insert SystemAgent {\n    name := <str>$name,\n    roles := array_unpack(<optional array<Role>>$roles)\n  })\n) {*}",
      {
        "query": "\n      select (\n        (select SystemAgent filter .name = <str>$name) ??\n        (insert SystemAgent {\n          name := <str>$name,\n          roles := array_unpack(<optional array<Role>>$roles)\n        })\n      ) {*}\n    ",
        "cardinality": "One"
      }
    ],
    [
      "with\n project := <Project><uuid>$projectId,\n steps := array_unpack(<array<Project::Step>>$steps),\n mostRecentEvent := (\n  select project.workflowEvents\n  filter .to in steps if exists steps else true\n  order by .at desc\n  limit 1\n)\nselect mostRecentEvent.to",
      {
        "query": "\n      with\n       project := <Project><uuid>$projectId,\n       steps := array_unpack(<array<Project::Step>>$steps),\n       mostRecentEvent := (\n        select project.workflowEvents\n        filter .to in steps if exists steps else true\n        order by .at desc\n        limit 1\n      )\n      select mostRecentEvent.to\n    ",
        "cardinality": "AtMostOne"
      }
    ]
  ]);
