import { Button, Column, Section, Text } from '@seedcompany/nestjs-email/templates';
import { fiscalQuarter, fiscalYear } from '~/common';
import { type Language } from '../../../components/language/dto';
import { type PeriodicReport } from '../../../components/periodic-report/dto';
import { ProgressReportStatus } from '../../../components/progress-report/dto';
import { type ProgressReportWorkflowEvent } from '../../../components/progress-report/workflow/dto/workflow-event.dto';
import { type Project } from '../../../components/project/dto';
import { type User } from '../../../components/user/dto';
import { EmailTemplate, Heading } from './base';
import { FormattedDateTime } from './formatted-date-time';
import { useFrontendUrl } from './frontend-url';
import { UserRef, type UserRefProps } from './user-ref';

export interface ProgressReportStatusChangedProps {
  changedBy: UserRefProps;
  recipient: Pick<User, 'email' | 'displayFirstName' | 'displayLastName' | 'timezone'>;
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
  const reportLabel = `Quarterly Report - Q${fiscalQuarter(report.start)} FY${fiscalYear(
    report.start,
  )}`;

  const oldStatus = previousStatusVal
    ? ProgressReportStatus.entry(previousStatusVal).label
    : undefined;
  const newStatus = newStatusVal ? ProgressReportStatus.entry(newStatusVal).label : undefined;

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

      <Section>
        <Column>
          <Text paddingBottom={16}>
            <UserRef {...changedBy} /> has changed <a href={reportUrl}>{reportLabel}</a>{' '}
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
              <FormattedDateTime value={workflowEvent.at} timezone={recipient.timezone.value} />
            </>
          </Text>
          <Button href={reportUrl} paddingTop={16}>
            View {reportLabel}
          </Button>
        </Column>
      </Section>
    </EmailTemplate>
  );
}
