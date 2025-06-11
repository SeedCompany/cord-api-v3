import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { CommonRepository, e } from '~/core/gel';
import { type PinRepository } from './pin.repository';

@Injectable()
export class PinGelRepository extends CommonRepository implements PublicOf<PinRepository> {
  async isPinned(id: ID) {
    const resource = e.cast(e.Mixin.Pinnable, e.uuid(id));
    const query = e.op(resource, 'in', e.global.currentUser.pins);
    return await this.db.run(query);
  }

  async add(id: ID) {
    const resource = e.cast(e.Mixin.Pinnable, e.uuid(id));
    const query = e.update(e.global.currentUser, () => ({
      set: { pins: { '+=': resource } },
    }));
    await this.db.run(query);
  }

  async remove(id: ID) {
    const resource = e.cast(e.Mixin.Pinnable, e.uuid(id));
    const query = e.update(e.global.currentUser, () => ({
      set: { pins: { '-=': resource } },
    }));
    await this.db.run(query);
  }
}
