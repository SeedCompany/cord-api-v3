import { EventsHandler, type IEventHandler } from '~/core';
import {
  type ProjectCreatedEvent,
  ProjectDeletedEvent,
} from '../../project/events';

@EventsHandler(ProjectDeletedEvent)
export class DetachProjectRootDirectoryHandler implements IEventHandler<ProjectCreatedEvent> {
  async handle(_event: ProjectDeletedEvent) {
    // TODO Update DB is some fashion
  }
}
