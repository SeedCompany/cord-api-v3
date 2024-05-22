import {
  Button,
  Column,
  HideInText,
  Section,
  Text,
} from '@seedcompany/nestjs-email/templates';
import { startCase } from 'lodash';
import { EmailNotification as StepChangeNotification } from '../../../components/project';
import { ProjectType } from '../../../components/project/dto/project-type.enum';
import { EmailTemplate, Heading } from './base';
import { FormattedDateTime } from './formatted-date-time';
import { useFrontendUrl } from './frontend-url';
import { UserRef } from './user-ref';

export function ProjectStepChanged({
  project,
  changedBy,
  previousStep: oldStepVal,
  recipient,
  primaryPartnerName,
}: StepChangeNotification) {
  const projectUrl = useFrontendUrl(`/projects/${project.id}`);
  const projectName = project.name.value;
  const projectType = project.type;
  const oldStep = startCase(oldStepVal) || undefined;
  const newStep = startCase(project.step.value) || undefined;
  const multiplicationTitle =
    projectName && newStep && primaryPartnerName
      ? `${projectType} - ${projectName} - ${primaryPartnerName} - is pending ${newStep} approval`
      : projectName && newStep
      ? `${projectType} - ${projectName} - is pending ${newStep} approval`
      : `${projectType} - Project Status Change`;
  const momentumTitle =
    projectName && oldStep && newStep
      ? `${projectName} changed from ${oldStep} to ${newStep}`
      : 'Project Status Change';

  return (
    <EmailTemplate
      title={
        projectType === ProjectType.MultiplicationTranslation
          ? multiplicationTitle
          : momentumTitle
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
            <UserRef {...changedBy} /> has changed{' '}
            {projectName ? 'project ' : ''}
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
            at{' '}
            <FormattedDateTime
              value={project.modifiedAt}
              timezone={recipient.timezone.value}
            />
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
