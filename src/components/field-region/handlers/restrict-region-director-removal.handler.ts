import { InputException } from '~/common';
import { OnHook } from '~/core/hooks';
import { UserUpdatedHook } from '../../user/hooks/user-updated.hook';
import { FieldRegionRepository } from '../field-region.repository';

@OnHook(UserUpdatedHook)
export class RestrictRegionDirectorRemovalHandler {
  constructor(private readonly repo: FieldRegionRepository) {}

  async handle(event: UserUpdatedHook) {
    if (!event.input.roles) {
      return;
    }
    const roleRemoved =
      event.previous.roles.includes('RegionalDirector') &&
      !event.updated.roles.includes('RegionalDirector');
    if (!roleRemoved) {
      return;
    }

    const regions = await this.repo.readAllByDirector(event.updated.id);
    if (regions.length > 0) {
      throw new InputException(
        'User is still a director for these field regions:\n' +
          regions.map((z) => `  - ${z.name}`).join('\n'),
      );
    }
  }
}
