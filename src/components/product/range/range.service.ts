import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import { DatabaseService, ILogger, Logger, OnIndex } from '../../../core';
import { CreateRange, Range, RangeListOutput, UpdateRange } from './dto';

@Injectable()
export class RangeService {
  constructor(
    @Logger('range:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:range]-() ASSERT EXISTS(r.createdAt)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  async create(input: CreateRange, session: ISession): Promise<Range> {
    const { start, end } = input;
    const id = generate();
    const createdAt = DateTime.local();
    try {
      await this.db
        .query()
        .create([
          node('range', 'Range:Property', {
            value: 'placeholder',
            active: true,
            id,
            createdAt,
            start,
            end,
            owningOrgId: session.owningOrgId,
          }),
        ])
        .return('range.id as id')
        .first();
    } catch (err) {
      this.logger.error(`Could not create range for user ${session.userId}`);
      throw new ServerException('Could not create range');
    }
    this.logger.info(`range created, id ${id}`);
    return this.readOne(id, session);
  }

  async readOne(rangeId: string, _session: ISession): Promise<Range> {
    const readRange = this.db
      .query()
      .match([node('range', 'Range:Property', { active: true, id: rangeId })])
      .return({
        range: [{ start: 'start', end: 'end', id: 'id' }],
      });

    const result = await readRange.first();

    if (!result) {
      throw new NotFoundException('Could not find range');
    }

    return {
      id: rangeId,
      start: result.start,
      end: result.end,
      createdAt: result.createdAt,
    };
  }

  async update(input: UpdateRange, session: ISession): Promise<Range> {
    const modifiedAt = DateTime.local();
    const updateRange = this.db
      .query()
      .match([node('range', 'Range:Property', { active: true, id: input.id })])
      .set({
        values: {
          range: {
            start: input.start,
            end: input.end,
            modifiedAt,
            modifiedBy: session.userId,
          },
        },
      });
    try {
      const _result = await updateRange.first();
      // console.log('result ', JSON.stringify(result, null, 2));
    } catch (e) {
      this.logger.error(e);
      throw new ServerException('Range not updated');
    }

    return this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const delRange = this.db
      .query()
      .match([node('range', 'Range:Property', { active: true, id })])
      .set({
        values: {
          range: {
            deletedBy: session.userId,
            active: false,
          },
        },
      });
    try {
      await delRange.first();
    } catch (e) {
      this.logger.error(e);
      throw new ServerException('Range not deleted');
    }
  }

  async list(nodeId: string, session: ISession): Promise<RangeListOutput> {
    const query = this.db
      .query()
      .match([
        node('node', 'BaseNode', { active: true, id: nodeId }),
        relation('out', '', 'range', { active: true }),
        node('range', 'Range:Property', { active: true }),
      ])
      .return('range.id as id');
    const result = await query.run();
    // console.log('result ', JSON.stringify(result, null, 2));

    if (!result) {
      return { items: [], total: 0, hasMore: false };
    }
    const items = await Promise.all(
      result.map((r) => {
        return this.readOne(r.id, session);
      })
    );
    // console.log('items ', JSON.stringify(items, null, 2));

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }
}
