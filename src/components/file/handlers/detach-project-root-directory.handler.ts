import { OnHook } from '~/core';
import {
  type ProjectCreatedHook,
  ProjectDeletedHook,
} from '../../project/hooks';

@OnHook(ProjectDeletedHook)
export class DetachProjectRootDirectoryHandler {
  async handle(_event: ProjectDeletedHook) {
    // TODO Update DB is some fashion
  }
}
