import { eq } from 'drizzle-orm';
import { ConfigService } from '~/core/config';
import { DrizzleService } from '~/core/drizzle';
import { projects } from '~/core/drizzle/schema';
import { OnHook } from '~/core/hooks';
import { ProjectCreatedHook } from '../../project/hooks';
import { FileService } from '../file.service';

@OnHook(ProjectCreatedHook)
export class AttachProjectRootDirectoryHandler {
  constructor(
    private readonly files: FileService,
    private readonly config: ConfigService,
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

    // Neo4j persists this as the project's `rootDirectory` relationship (made by
    // createRootDirectory). Postgres has no back-edge — set the FK column on the
    // project row directly. Runs in the create transaction (tx-aware client).
    // migration-todo: drop this engine check at Phase 7 cutover (always PG).
    if (this.config.databaseEngine === 'postgres') {
      await this.drizzle.client
        .update(projects)
        .set({ rootDirectoryId: rootDirId })
        .where(eq(projects.id, project.id));
    }
  }
}
