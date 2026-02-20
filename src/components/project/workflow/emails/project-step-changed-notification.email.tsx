import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { useModuleRef } from '~/core/email';
import { UserService } from '../../../user/user.service';
import { type ProjectStep } from '../../dto';
import { ProjectService } from '../../project.service';
import {
  ProjectStepChanged,
  type ProjectStepChangedProps,
} from './project-step-changed.email';

export interface ProjectStepChangedNotificationProps {
  projectId: ID<'Project'>;
  changedById: ID<'User'>;
  previousStep: ProjectStep;
}

export async function ProjectStepChangedNotification({
  projectId,
  changedById,
  previousStep,
}: ProjectStepChangedNotificationProps) {
  const moduleRef = useModuleRef();
  const identity = moduleRef.get(Identity, { strict: false });
  const users = moduleRef.get(UserService, { strict: false });
  const projects = moduleRef.get(ProjectService, { strict: false });

  const [changedByUnsecured, project, primaryPartnerName, recipient] =
    await Promise.all([
      identity.asUser(changedById, () => users.readOne(changedById)),
      identity.asUser(identity.current.userId, () =>
        projects.readOne(projectId),
      ),
      projects.getPrimaryOrganizationName(projectId),
      users.readOne(identity.current.userId),
    ]);

  const props: ProjectStepChangedProps = {
    recipient,
    changedBy: changedByUnsecured,
    project,
    previousStep,
    primaryPartnerName,
  };

  return <ProjectStepChanged {...props} />;
}
