import { cleanJoin } from '@seedcompany/common';
import {
  EmailTemplate,
  FormattedDateTime,
  Heading,
  InHtml,
  Mjml,
  useFrontendUrl,
  UserRef,
} from '~/core/email';
import { type User } from '../../../user/dto';
import {
  type Project,
  ProjectStep as Step,
  ProjectType as Type,
} from '../../dto';

export interface ProjectStepChangedProps {
  recipient: Pick<
    User,
    'email' | 'displayFirstName' | 'displayLastName' | 'timezone'
  >;
  changedBy: Pick<User, 'id' | 'displayFirstName' | 'displayLastName'>;
  project: Pick<Project, 'id' | 'modifiedAt' | 'name' | 'step' | 'type'>;
  previousStep: Step;
  primaryPartnerName: string | null;
}

export function ProjectStepChanged({
  project,
  changedBy,
  previousStep: oldStepVal,
  recipient,
  primaryPartnerName,
}: ProjectStepChangedProps) {
  const projectUrl = useFrontendUrl(`/projects/${project.id}`);
  const projectName = project.name.value;
  const projectType = Type.entry(project.type);
  const oldStep = Step.entry(oldStepVal).label;
  const newStep = project.step.value
    ? Step.entry(project.step.value).label
    : undefined;

  const isMultiplication = projectType.value === Type.MultiplicationTranslation;
  const title = cleanJoin(' - ', [
    isMultiplication && projectType.label,
    projectName ?? 'Project',
    isMultiplication && primaryPartnerName,
    newStep ? `is ${newStep}` : 'Status Change',
  ]);

  return (
    <EmailTemplate title={title}>
      <Heading>
        {projectName && newStep ? (
          <>
            {projectName} is now <em>{newStep}</em>
          </>
        ) : (
          `${projectName ?? 'A project'} has a new status`
        )}
      </Heading>

      <Mjml.Section>
        <Mjml.Column>
          <Mjml.Text paddingBottom={16}>
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
          </Mjml.Text>
          <InHtml>
            <Mjml.Button href={projectUrl} paddingTop={16}>
              View {projectName ?? 'Project'}
            </Mjml.Button>
          </InHtml>
        </Mjml.Column>
      </Mjml.Section>
    </EmailTemplate>
  );
}
