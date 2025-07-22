import { fiscalQuarter, fiscalYear } from '~/common';
import {
  EmailTemplate,
  FormattedDateTime,
  Heading,
  Mjml,
  useFrontendUrl,
  UserRef,
  type UserRefProps,
} from '~/core/email';
import { type Language } from '../../../language/dto';
import { type PeriodicReport } from '../../../periodic-report/dto';
import { type Project } from '../../../project/dto';
import { type User } from '../../../user/dto';
import { ProgressReportStatus } from '../../dto';
import { type ProgressReportWorkflowEvent } from '../dto/workflow-event.dto';

export interface ProgressReportStatusChangedProps {
  changedBy: UserRefProps;
  recipient: Pick<
    User,
    'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  project: Pick<Project, 'id' | 'name'>;
  language: Pick<Language, 'id' | 'name' | 'displayName'>;
  report: Pick<PeriodicReport, 'id' | 'status' | 'start' | 'type'>;
  newStatusVal?: ProgressReportStatus;
  previousStatusVal?: ProgressReportStatus;
  workflowEvent: ProgressReportWorkflowEvent;
}

export function ProgressReportStatusChanged({
  changedBy,
  recipient,
  project,
  language,
  report,
  newStatusVal,
  previousStatusVal,
  workflowEvent,
}: ProgressReportStatusChangedProps) {
  const projectUrl = useFrontendUrl(`/projects/${project.id}`);
  const projectName = project.name.value || '';
  const languageName = language.name.value || '';
  const reportUrl = useFrontendUrl(`/progress-reports/${report.id}`);
  const reportLabel = `Quarterly Report - Q${fiscalQuarter(
    report.start,
  )} FY${fiscalYear(report.start)}`;

  const oldStatus = previousStatusVal
    ? ProgressReportStatus.entry(previousStatusVal).label
    : undefined;
  const newStatus = newStatusVal
    ? ProgressReportStatus.entry(newStatusVal).label
    : undefined;

  return (
    <EmailTemplate
      title={
        oldStatus && newStatus
          ? `${languageName} (${projectName}) ${reportLabel} changed from ${oldStatus} to ${newStatus}`
          : `${languageName} (${projectName}) ${reportLabel} Status Change`
      }
    >
      <Heading>
        {newStatus ? (
          <>
            {reportLabel} is now <em>{newStatus}</em>
          </>
        ) : (
          `${reportLabel} has a new status`
        )}
      </Heading>

      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text paddingBottom={16}>
            <UserRef {...changedBy} /> has changed{' '}
            <a href={reportUrl}>{reportLabel}</a>{' '}
            {newStatus ? (
              <>
                {oldStatus ? (
                  <>
                    from <em>{oldStatus}</em>{' '}
                  </>
                ) : null}
                to <em>{newStatus}</em>{' '}
              </>
            ) : null}
            <>
              for {languageName} in <a href={projectUrl}>{projectName}</a> on{' '}
              <FormattedDateTime
                value={workflowEvent.at}
                timezone={recipient.timezone.value}
              />
            </>
          </Mjml.Text>
          <Mjml.Button href={reportUrl} paddingTop={16}>
            View {reportLabel}
          </Mjml.Button>
        </Mjml.Column>
      </Mjml.Section>
    </EmailTemplate>
  );
}
