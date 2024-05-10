import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ID, PublicOf, Session } from '~/common';
import { Client } from '~/core/edgedb';
import { PinRepository } from './pin.repository';

@Injectable()
export class PinEdgeDBRepository implements PublicOf<PinRepository> {
  constructor(@Inject(Client) private readonly client: Client) {}

  async isPinned(id: ID, session: Session): Promise<boolean> {
    const res: boolean | null = await this.client.querySingle(
      `
      select exists(
        select BaseNode {
          id,
          pinned_by := .<pinned[is User]> {
            id
          }
        }
        filter .id = <uuid>$id
        and .pinned_by.id = <uuid>$userId
      );
    `,
      {
        id,
        userId: session.userId,
      },
    );

    return Boolean(res);
  }

  async add(id: ID, session: Session): Promise<void> {
    const createdAt = DateTime.local();

    await this.client.query(
      `
      with BaseNode := (
        select BaseNode
        filter .id = <uuid>$id
      ),
      User := (
        select User
        filter .id = <uuid>$userId
      )
      insert PinnedRelation {
        node := BaseNode,
        user := User,
        createdAt := <datetime>$createdAt
      }
      unless conflict on (.node, .user)
    `,
      {
        id,
        userId: session.userId,
        createdAt: createdAt.toJSDate(),
      },
    );
  }

  async remove(id: ID, session: Session): Promise<void> {
    await this.client.query(
      `
      with BaseNode := (
        select BaseNode
        filter .id = <uuid>$id
      ),
      User := (
        select User
        filter .id = <uuid>$userId
      )
      delete PinnedRelation
      filter .node = BaseNode
        and .user = User
    `,
      {
        id,
        userId: session.userId,
      },
    );
  }
}
