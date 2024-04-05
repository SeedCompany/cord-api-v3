import { DatabaseService, EventsHandler, IEventHandler } from '~/core';
import { ProjectCreatedEvent } from '../../project/events';
import { FileService } from '../file.service';

@EventsHandler(ProjectCreatedEvent)
export class AttachProjectRootDirectoryHandler
  implements IEventHandler<ProjectCreatedEvent>
{
  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService,
  ) {}

  async handle(event: ProjectCreatedEvent) {
    const { project, session } = event;

    const rootDirId = await this.files.createRootDirectory({
      resource: project,
      relation: 'rootDirectory',
      name: `${project.id} root directory`,
      session,
    });

    event.project = {
      ...event.project,
      rootDirectory: { id: rootDirId },
    };

    const folders = [
      'Approval Documents',
      'Consultant Reports',
      'Field Correspondence',
      'Photos',
    ];
    for (const folder of folders) {
      await this.files.createDirectory(rootDirId, folder, session);
    }
  }
}
