import { eq } from 'drizzle-orm';
import { DrizzleService } from '~/core/drizzle';
import { projects } from '~/core/drizzle/schema';
import { OnHook } from '~/core/hooks';
import { ProjectCreatedHook } from '../../project/hooks';
import { FileService } from '../file.service';

@OnHook(ProjectCreatedHook)
export class AttachProjectRootDirectoryHandler {
  constructor(
    private readonly files: FileService,
    private readonly drizzle: DrizzleService,
  ) {}

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

    // createRootDirectory makes no back-edge, so set the FK column on the
    // project row directly. Runs in the create transaction (tx-aware client).
    await this.drizzle.client
      .update(projects)
      .set({ rootDirectoryId: rootDirId })
      .where(eq(projects.id, project.id));
  }
}
