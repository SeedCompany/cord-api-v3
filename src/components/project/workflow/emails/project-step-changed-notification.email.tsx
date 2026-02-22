import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { useModuleRef, useResources } from '~/core/email';
import { UserService } from '../../../user';
import { type ProjectStep } from '../../dto';
import { ProjectService } from '../../project.service';
import { ProjectStepChanged } from './project-step-changed.email';

export interface ProjectStepChangedNotificationProps {
  workflowEventId: ID<'ProjectWorkflowEvent'>;
  previousStep: ProjectStep;
}

/**
 * Async email component that loads the data needed for the
 * ProjectStepChanged email template from the notification fields.
 * Rendered within the delivery worker's recipient user context.
 */
export async function ProjectStepChangedNotification({
  workflowEventId,
  previousStep,
}: ProjectStepChangedNotificationProps) {
  const moduleRef = useModuleRef();
  const resources = useResources();
  const identity = moduleRef.get(Identity, { strict: false });
  const users = moduleRef.get(UserService, { strict: false });
  const projects = moduleRef.get(ProjectService, { strict: false });

  // The delivery worker renders this as the recipient user,
  // so all reads are in that user's security context.
  const workflowEvent = await resources.load(
    'ProjectWorkflowEvent',
    workflowEventId,
  );
  const projectId = workflowEvent.project.id;

  const [changedBy, project, primaryPartnerName, recipient] = await Promise.all(
    [
      users.readOne(workflowEvent.who.value!.id),
      projects.readOne(projectId),
      projects.getPrimaryOrganizationName(projectId),
      users.readOne(identity.current.userId),
    ],
  );

  return (
    <ProjectStepChanged
      recipient={recipient}
      changedBy={changedBy}
      project={project}
      previousStep={previousStep}
      primaryPartnerName={primaryPartnerName}
    />
  );
}
