import { InputException } from '~/common';
import { OnHook } from '~/core/hooks';
import { UserUpdatedHook } from '../../user/hooks/user-updated.hook';
import { FieldZoneRepository } from '../field-zone.repository';

@OnHook(UserUpdatedHook)
export class RestrictZoneDirectorRemovalHandler {
  constructor(private readonly repo: FieldZoneRepository) {}

  async handle(event: UserUpdatedHook) {
    if (!event.input.roles) {
      return;
    }
    const roleRemoved =
      event.previous.roles.includes('FieldOperationsDirector') &&
      !event.updated.roles.includes('FieldOperationsDirector');
    if (!roleRemoved) {
      return;
    }

    const zones = await this.repo.readAllByDirector(event.updated.id);
    if (zones.length > 0) {
      throw new InputException(
        'User is still a director for these field zones:\n' +
          zones.map((z) => `  - ${z.name}`).join('\n'),
      );
    }
  }
}
