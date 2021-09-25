import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  NotFoundException,
  PaginatedListType,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  createNode,
  createRelationships,
  matchProps,
  merge,
  paginate,
  variable,
} from '../../core/database/query';
import { createDirectory } from '../file/file.repository';
import { CreateQuestionAnswer, QuestionAnswer } from './dto';

@Injectable()
export class QuestionAnswerRepository extends DtoRepository(QuestionAnswer) {
  async readOne(
    id: ID,
    session: Session
  ): Promise<UnsecuredDto<QuestionAnswer>> {
    const result = await this.readMany([id], session);
    if (!result[0]) {
      throw new NotFoundException('Could not find question/answer');
    }
    return result[0];
  }

  async readMany(
    ids: readonly ID[],
    _session: Session
  ): Promise<ReadonlyArray<UnsecuredDto<QuestionAnswer>>> {
    return await this.db
      .query()
      .matchNode('node', 'QuestionAnswer')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async list(
    parent: ID,
    _session: Session
  ): Promise<PaginatedListType<UnsecuredDto<QuestionAnswer>>> {
    const result = await this.db
      .query()
      .match([
        node('parent', 'BaseNode', { id: parent }),
        relation('out', '', QuestionAnswer.Rel),
        node('node', 'QuestionAnswer'),
      ])
      .apply(paginate({ page: 1, count: 100 }, this.hydrate()))
      .first();
    return result!;
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('parent', 'BaseNode'),
          relation('out', '', QuestionAnswer.Rel),
          node('node'),
          relation('out', '', 'media'),
          node('media', 'Directory'),
        ])
        .return<{ dto: UnsecuredDto<QuestionAnswer> }>(
          merge('props', {
            parent: 'parent',
            media: 'media.id',
          }).as('dto')
        );
  }

  async create(input: CreateQuestionAnswer, session: Session) {
    const initialProps = {
      question: input.question,
      answer: input.answer,
      category: input.category,
    };
    const dirCreator = await createDirectory({
      name: 'Media Attachments',
      creator: session,
    });
    const result = await this.db
      .query()
      .apply(await createNode(QuestionAnswer, { initialProps }))
      .subQuery((sub) => sub.apply(dirCreator).return('node as media'))
      .apply(
        createRelationships(QuestionAnswer, {
          in: { [QuestionAnswer.Rel]: ['BaseNode', input.parentId] },
          out: { media: variable('media') },
        })
      )
      .apply(this.hydrate())
      .first();
    if (!result) {
      throw new ServerException('Failed to create question/answer');
    }
    return result.dto;
  }
}
