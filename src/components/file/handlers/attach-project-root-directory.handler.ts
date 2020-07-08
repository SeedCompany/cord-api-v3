import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DatabaseService, EventsHandler, IEventHandler } from '../../../core';
import { ProjectCreatedEvent } from '../../project/events';
import { FileService } from '../file.service';

@EventsHandler(ProjectCreatedEvent)
export class AttachProjectRootDirectoryHandler
  implements IEventHandler<ProjectCreatedEvent> {
  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService
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
        [node('project', 'Project', { id, active: true })],
        [node('dir', 'Directory', { id: rootDir.id, active: true })],
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
  }
}
