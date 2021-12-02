import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

@Migration('2021-12-02T17:49:20')
export class MembershipShareability extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .match([
        node('post', 'Post'),
        relation('out', '', 'shareability'),
        node('postShareability', 'Property'),
      ])
      .where({ 'postShareability.value': 'ProjectTeam' })
      .set({
        values: {
          postShareability: {
            value: 'Membership',
          },
        },
      })
      .return<{ numOfPosts: number }>('count(postShareability) as numOfPosts')
      .first();
    this.logger.info(`${res?.numOfPosts ?? 0} post shareability changed`);
  }
}
