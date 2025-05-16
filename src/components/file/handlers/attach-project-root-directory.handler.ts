import { EventsHandler, type IEventHandler } from '~/core';
import { ProjectCreatedEvent } from '../../project/events';
import { FileService } from '../file.service';

@EventsHandler(ProjectCreatedEvent)
export class AttachProjectRootDirectoryHandler
  implements IEventHandler<ProjectCreatedEvent>
{
  constructor(private readonly files: FileService) {}

  async handle(event: ProjectCreatedEvent) {
    const { project } = event;

    const rootDirId = await this.files.createRootDirectory({
      resource: project,
      relation: 'rootDirectory',
      name: `${project.id} root directory`,
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
      await this.files.createDirectory(rootDirId, folder);
    }
  }
}
