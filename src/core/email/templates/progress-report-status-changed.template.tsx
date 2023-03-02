import {
  Button,
  Column,
  Section,
  Text,
} from '@seedcompany/nestjs-email/templates';
import { startCase } from 'lodash';
import { fiscalQuarter, fiscalYear } from '~/common';
import { Language } from '../../../components/language';
import { PeriodicReport } from '../../../components/periodic-report';
import { ProgressReportStatus } from '../../../components/progress-report/dto';
import { ProgressReportWorkflowEvent } from '../../../components/progress-report/workflow/dto/workflow-event.dto';
import { Project } from '../../../components/project';
import { User } from '../../../components/user';
import { EmailTemplate, Heading } from './base';
import { FormattedDateTime } from './formatted-date-time';
import { useFrontendUrl } from './frontend-url';
import { UserRef, UserRefProps } from './user-ref';

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

  const oldStatus = startCase(previousStatusVal) || undefined;
  const newStatus = startCase(newStatusVal) || undefined;

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
          </Text>
          <Button href={reportUrl} paddingTop={16}>
            View {reportLabel}
          </Button>
        </Column>
      </Section>
    </EmailTemplate>
  );
}
