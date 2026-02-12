import { OnHook } from '~/core/hooks';
import { ProjectDeletedHook } from '../../project/hooks';

@OnHook(ProjectDeletedHook)
export class DetachProjectRootDirectoryHandler {
  async handle(_event: ProjectDeletedHook) {
    // TODO Update DB is some fashion
  }
}
