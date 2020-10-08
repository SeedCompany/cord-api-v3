import { startCase } from 'lodash';
import { DateTime } from 'luxon';
import * as React from 'react';
import { Project, ProjectStep } from '../../../components/project/dto';
import { fullName } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { EmailTemplate, Heading } from './base';
import { useFrontendUrl } from './frontend-url';
import { Button, Column, Section, Text } from './mjml';
import { HideInText } from './text-rendering';

export interface ProjectStepChangedProps {
  project: Project;
  changedBy: User;
  changedAt: DateTime;
  oldStep?: ProjectStep;
}

export function ProjectStepChanged({
  project,
  changedBy,
  changedAt,
  oldStep: oldStepVal,
}: ProjectStepChangedProps) {
  const projectUrl = useFrontendUrl(`/projects/${project.id}`);
  const projectName = project.name.value;

  const changerUrl = useFrontendUrl(`/users/${changedBy.id}`);
  const changerName = fullName(changedBy);

  const oldStep = startCase(oldStepVal) || undefined;
  const newStep = startCase(project.step.value) || undefined;

  const changedAtFormatted = changedAt
    .setZone('America/Chicago') // TODO use recipient's timezone
    .toLocaleString(DateTime.DATETIME_FULL);

  return (
    <EmailTemplate title="Project Status Change">
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
            {oldStep ? (
              <>
                from <em>{oldStep}</em>{' '}
              </>
            ) : null}
            to <em>{newStep}</em> at {changedAtFormatted}
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
