import { BaseMigration, Migration } from '../../../core';

@Migration('2021-08-01T15:30:05')
export class EightySevenSixCommentsMigration extends BaseMigration {
  // :Post nodes have postMigration property in case of reversion
  // using project.createdAt for post.modifiedAt –– it's an approximation, but not sure if we want to do that
  async up() {
    const before = await this.getPostCount(true);
    this.logger.info(`${before} 87Six comments before migration`);
    await this.db
      .query()
      .raw(
        ` 
          match(u:RootUser)
          match(p:Project)
          with u.id as rootId, p,
          [
            { type: 'Note', shareability: 'Internal', body: p.commentDescription }, 
            { type: 'Prayer', shareability: 'AskToShareExternally', body: p.commentPrayerNeeds }, 
            { type: 'Note', shareability: 'Internal', body: p.commentProposalComments }
          ] as posts
          unwind posts as post
          with rootId, p, post
          where size(post.body) > 0
          create 
            (p)-[:post { active: true, createdAt: datetime() }]->(po:BaseNode:Post{ postMigration: true, createdAt: datetime(), id: apoc.create.uuid() }),
              (po)-[:shareability { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: post.shareability, sortValue: post.shareability }),
              (po)-[:type { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: post.type, sortValue: post.type }),
              (po)-[:body { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: post.body, sortValue: post.body }),
              (po)-[:modifiedAt { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: p.createdAt, sortValue: p.createdAt }),
              (po)-[:creator { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: rootId, sortValue: rootId })
        `
      )
      .run();
    const after = await this.getPostCount(false);
    this.logger.info(`${after} Cord V3 posts after migration`);

    if (before === after) {
      await this.db
        .query()
        .raw(
          `
          match(p:Project)
          remove p.commentDescription, p.commentPrayerNeeds, p.commentProposalComments
        `
        )
        .run();
    }
  }

  private async getPostCount(before: boolean) {
    const res = await this.db
      .query()
      .raw(
        before
          ? `
              match(p:Project)
              with [ p.commentDescription, p.commentPrayerNeeds, p.commentProposalComments ] as protoPosts
              unwind protoPosts as po
              with po
              where size(po) > 0
            `
          : `
              match(po:Post { postMigration: true })
            `
      )
      .return<{ count: number }>('count(po) as count')
      .first();
    return res?.count ?? 0;
  }
}
