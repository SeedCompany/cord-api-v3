import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { ProjectCreatedEvent } from '../../project/events';
import { FileService } from '../file.service';
import { DbDirectory } from '../model';

@EventsHandler(ProjectCreatedEvent)
export class AttachProjectRootDirectoryHandler
  implements IEventHandler<ProjectCreatedEvent> {
  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService
  ) {}

  async handle({ project, session }: ProjectCreatedEvent) {
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

    const dbDirectory = new DbDirectory();
    await this.authorizationService.processNewBaseNode(
      dbDirectory,
      rootDir.id,
      session.userId!
    );
  }
}
