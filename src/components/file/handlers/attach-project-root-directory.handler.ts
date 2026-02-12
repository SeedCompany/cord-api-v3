import { OnHook } from '~/core/hooks';
import { ProjectCreatedHook } from '../../project/hooks';
import { FileService } from '../file.service';

@OnHook(ProjectCreatedHook)
export class AttachProjectRootDirectoryHandler {
  constructor(private readonly files: FileService) {}

  async handle(event: ProjectCreatedHook) {
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
