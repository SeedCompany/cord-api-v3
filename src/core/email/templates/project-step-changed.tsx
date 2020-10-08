import { startCase } from 'lodash';
import { DateTime } from 'luxon';
import * as React from 'react';
import { Project, ProjectStep } from '../../../components/project/dto';
import { fullName } from '../../../components/user';
import { User } from '../../../components/user/dto';
import { EmailTemplate, Heading, Link } from './base';
import { useFrontendUrl } from './frontend-url';
import { Button, Column, Divider, Section, Text } from './mjml';
import { HideInText } from './text-rendering';

export interface ProjectStepChangedProps {
  project: Project;
  changedBy: User;
  changedAt: DateTime;
  oldStep: ProjectStep;
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

  const oldStep = startCase(oldStepVal);
  const newStep = startCase(project.step.value) || undefined;
  const changedAtString = changedAt
    .setZone('America/Chicago') // TODO use recipient's timezone
    .toLocaleString(DateTime.DATETIME_FULL);
  return (
    <EmailTemplate title="Project Status Change">
      <Heading>
        {projectName && newStep ? (
          <>
            {projectName} is now <i>{newStep}</i>
          </>
        ) : (
          `${projectName ?? 'A project'} has a new status`
        )}
      </Heading>

      <Section>
        <Column>
          <Text>
            {changerName ? <a href={changerUrl}>{changerName}</a> : 'Someone'}{' '}
            has changed {projectName ? 'project ' : ''}
            <a href={projectUrl}>
              {projectName ? `${projectName}` : 'a project'}
            </a>
            from <i>{oldStep}</i> to <i>{newStep}</i> at {changedAtString}
          </Text>
          <Divider borderWidth={1} />
          <Text>View the project here:</Text>
          <HideInText>
            <Button href={projectUrl}>View {projectName ?? 'Project'}</Button>
          </HideInText>
          <Link href={projectUrl} />
        </Column>
      </Section>
    </EmailTemplate>
  );
}
