import { Inject, Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { CommonRepository } from '~/core/database';
import { Client } from '~/core/edgedb';
import { PinRepository } from './pin.repository';

@Injectable()
export class PinEdgeDBRepository
  extends CommonRepository
  implements PublicOf<PinRepository>
{
  constructor(@Inject(Client) private readonly client: Client) {
    super();
  }

  async isPinned(id: ID): Promise<boolean> {
    const result = await this.client.querySingle(
      `
    select exists(
      select global currentUser {
        pins: {
          id
        }
      }
      filter <uuid>$id in global currentUser.pins.id
    )
    `,
      {
        id,
      },
    );

    return result as boolean;
  }

  async add(id: ID): Promise<void> {
    await this.client.query(
      `
      update global currentUser
      set {
        pins += <Mixin::Pinnable><uuid>$id
      }
    `,
      {
        id,
      },
    );
  }

  async remove(id: ID): Promise<void> {
    await this.client.query(
      `
      update global currentUser
      set {
        pins -= <Mixin::Pinnable><uuid>$id
      }
    `,
      {
        id,
      },
    );
  }
}
