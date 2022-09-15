import {
  Button,
  Column,
  HideInText,
  Section,
  Text,
} from '@seedcompany/nestjs-email/templates';
import { startCase } from 'lodash';
import { DateTime } from 'luxon';
import { EmailNotification as StepChangeNotification } from '../../../components/project';
import { fullName } from '../../../components/user';
import { EmailTemplate, Heading } from './base';
import { useFrontendUrl } from './frontend-url';

export function ProjectStepChanged({
  project,
  changedBy,
  previousStep: oldStepVal,
  recipient,
}: StepChangeNotification) {
  const projectUrl = useFrontendUrl(`/projects/${project.id}`);
  const projectName = project.name.value;

  const changerUrl = useFrontendUrl(`/users/${changedBy.id}`);
  const changerName = fullName(changedBy);

  const oldStep = startCase(oldStepVal) || undefined;
  const newStep = startCase(project.step.value) || undefined;

  const changedAtFormatted = project.modifiedAt
    .setZone(recipient.timezone.value ?? 'America/Chicago')
    .toLocaleString(DateTime.DATETIME_FULL);

  return (
    <EmailTemplate
      title={
        projectName && oldStep && newStep
          ? `${projectName} changed from ${oldStep} to ${newStep}`
          : 'Project Status Change'
      }
    >
      <Heading>
        {projectName && newStep ? (
          <>
            {projectName} is now <em>{newStep}</em>
          </>
        ) : (
          `${projectName ?? 'A project'} has a new status`
        )}
      </Heading>

      <Section>
        <Column>
          <Text paddingBottom={16}>
            {changerName ? <a href={changerUrl}>{changerName}</a> : 'Someone'}{' '}
            has changed {projectName ? 'project ' : ''}
            <a href={projectUrl}>{projectName ?? 'a project'}</a>{' '}
            {newStep ? (
              <>
                {oldStep ? (
                  <>
                    from <em>{oldStep}</em>{' '}
                  </>
                ) : null}
                to <em>{newStep}</em>{' '}
              </>
            ) : null}
            at {changedAtFormatted}
          </Text>
          <HideInText>
            <Button href={projectUrl} paddingTop={16}>
              View {projectName ?? 'Project'}
            </Button>
          </HideInText>
        </Column>
      </Section>
    </EmailTemplate>
  );
}
