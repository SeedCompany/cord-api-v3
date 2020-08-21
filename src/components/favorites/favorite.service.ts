import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ISession, ServerException, UnauthorizedException } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import {
  AddFavorite,
  Favorite,
  FavoriteListInput,
  FavoriteListOutput,
} from './dto';

@Injectable()
export class FavoriteService {
  constructor(
    @Logger('fav:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON ()-[r:favorite]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:favorite]-() ASSERT EXISTS(r.createdAt)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  async add(input: AddFavorite, session: ISession): Promise<string> {
    if (!session.userId) {
      throw new UnauthorizedException('user not logged in');
    }
    const createdAt = DateTime.local();
    const query = this.db
      .query()
      .match(matchSession(session))
      .match([node('node', 'BaseNode', { active: true, id: input.baseNodeId })])
      .create([
        [
          node('requestingUser'),
          relation('out', 'rel', 'favorite', { active: true, createdAt }),
          node('node'),
        ],
      ])
      .return('rel');
    try {
      await query.first();
    } catch (err) {
      this.logger.error(`Could not add favorite for user ${session.userId}`);
      throw new ServerException('Could not add favorite');
    }
    return input.baseNodeId;
  }

  async remove(baseNodeId: string, session: ISession): Promise<void> {
    if (!session.userId) {
      throw new UnauthorizedException('user not logged in');
    }
    const del = this.db
      .query()
      .match(matchSession(session))
      .match([node('node', 'BaseNode', { active: true, id: baseNodeId })])
      .match([
        [
          node('requestingUser'),
          relation('out', 'rel', 'favorite', { active: true }),
          node('node'),
        ],
      ])
      .setValues({
        'rel.active': false,
      })
      .return('rel');
    try {
      await del.first();
    } catch (e) {
      this.logger.error(e);
      throw new ServerException('favorite not removed');
    }
  }

  async list(
    input: FavoriteListInput,
    session: ISession
  ): Promise<FavoriteListOutput> {
    if (!session.userId) {
      throw new UnauthorizedException('user not logged in');
    }
    const baseNode = input.filter.baseNode
      ? input.filter.baseNode + ':BaseNode'
      : 'BaseNode';
    const query = this.db
      .query()
      .match(matchSession(session))
      .match([
        node('requestingUser'),
        relation('out', '', 'favorite', { active: true }),
        node('node', baseNode, { active: true }),
      ])
      .return('node.id as baseNodeId')
      .orderBy([input.sort], input.order)
      .skip((input.page - 1) * input.count)
      .limit(input.count);

    const countQuery = this.db
      .query()
      .match(matchSession(session))
      .match([
        node('requestingUser'),
        relation('out', '', 'favorite', { active: true }),
        node('node', baseNode, { active: true }),
      ])
      .return('count(node) as total');
    let result;
    let countResult;
    try {
      result = await query.run();
      countResult = await countQuery.run();
    } catch (e) {
      this.logger.error(e);
      throw new ServerException('favorite not found');
    }
    if (!result) {
      return { items: [], total: 0, hasMore: false };
    }

    const total = countResult[0]?.total || 0;
    const hasMore = (input.page - 1) * input.count + input.count < total;
    return {
      items: (result as unknown) as Favorite[],
      total,
      hasMore,
    };
  }
}
