import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ConfigService,
  DatabaseService,
  EventsHandler,
  IEventHandler,
} from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { ProjectCreatedEvent } from '../../project/events';
import { Directory } from '../dto';
import { FileService } from '../file.service';

@EventsHandler(ProjectCreatedEvent)
export class AttachProjectRootDirectoryHandler
  implements IEventHandler<ProjectCreatedEvent>
{
  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authorizationService: AuthorizationService
  ) {}

  async handle(event: ProjectCreatedEvent) {
    const { project, session } = event;
    const { id } = project;

    const rootDir = await this.files.createDirectory(
      undefined,
      `${id} root directory`,
      session
    );

    await this.db
      .query()
      .match([
        [node('project', 'Project', { id })],
        [node('dir', 'Directory', { id: rootDir.id })],
      ])
      .create([
        node('project'),
        relation('out', '', 'rootDirectory', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('dir'),
      ])
      .run();
    event.project = {
      ...event.project,
      rootDirectory: rootDir.id,
    };

    await this.authorizationService.processNewBaseNode(
      Directory,
      rootDir.id,
      session.userId
    );

    if (this.config.migration) {
      return; // skip default directories for migration
    }
    const folders = [
      'Approval Documents',
      'Consultant Reports',
      'Field Correspondence',
      'Photos',
    ];
    for (const folder of folders) {
      await this.files.createDirectory(rootDir.id, folder, session);
    }
  }
}
