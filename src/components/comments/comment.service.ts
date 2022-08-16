import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  NotFoundException,
  Order,
  Resource,
  ResourceShape,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentRepository } from './comment.repository';
import {
  Comment,
  Commentable,
  CommentListInput,
  CommentThread,
  CommentThreadListInput,
  CommentThreadListOutput,
  CreateComment,
  CreateCommentThread,
} from './dto';
import { UpdateComment } from './dto/update-comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private readonly repo: CommentRepository,
    private readonly commentThreadRepo: CommentThreadRepository,
    private readonly authorizationService: AuthorizationService,
    @Logger('comment:service') private readonly logger: ILogger
  ) {}
  async create(input: CreateComment, session: Session) {
    if (!input.threadId) {
      throw new ServerException('A comment must be associated with a thread');
    }

    try {
      const result = await this.repo.create(input, session);
      if (!result) {
        throw new ServerException('Failed to create comment');
      }
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.warning('Failed to create comment', {
        exception,
      });

      if (!(await this.repo.getBaseNode(input.threadId, 'CommentThread'))) {
        throw new InputException('threadId is invalid', 'comment.threadId');
      }

      throw new ServerException('Failed to create comment', exception);
    }
  }

  async readOne(id: ID, session: Session): Promise<Comment> {
    const dto = await this.repo.readOne(id);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const comments = await this.repo.readMany(ids);
    return await Promise.all(comments.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: UnsecuredDto<Comment>,
    session: Session
  ): Promise<Comment> {
    const securedProps = await this.authorizationService.secureProperties(
      Comment,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(input: UpdateComment, session: Session): Promise<Comment> {
    const object = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(object, input);
    await this.repo.updateProperties(object, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find comment', 'comment.id');
    }

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete comment', {
        exception,
      });

      throw new ServerException('Failed to delete comment', exception);
    }
  }

  async createThread(input: CreateCommentThread, session: Session) {
    if (!input.parentId) {
      throw new ServerException(
        'A comment thread must be associated with a parent node'
      );
    }

    try {
      const result = await this.commentThreadRepo.create(input, session);
      if (!result) {
        throw new ServerException('Failed to create comment thread');
      }

      return await this.readOneThread(result.id, session);
    } catch (exception) {
      this.logger.warning('Failed to create comment thread', {
        exception,
      });

      if (
        !(await this.commentThreadRepo.getBaseNode(input.parentId, 'BaseNode'))
      ) {
        throw new InputException('threadId is invalid', 'comment.threadId');
      }

      throw new ServerException('Failed to create comment thread', exception);
    }
  }

  async readOneThread(id: ID, session: Session) {
    const dto = await this.commentThreadRepo.readOne(id);
    const securedProps = await this.authorizationService.secureProperties(
      CommentThread,
      dto,
      session
    );

    const comments = await this.listCommentsByThreadId(
      {
        count: 25,
        sort: 'createdAt',
        page: 1,
        filter: { threadId: id },
        order: Order.ASC,
      },
      session
    );

    return {
      ...dto,
      securedProps,
      comments: comments.items,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async readManyThreads(ids: readonly ID[], session: Session) {
    const commentThreads = await this.commentThreadRepo.readMany(ids);
    return await Promise.all(
      commentThreads.map((dto) => this.readOneThread(dto.id, session))
    );
  }

  async listThreads(
    parentType: ResourceShape<Commentable>,
    parent: Commentable & Resource,
    input: CommentThreadListInput,
    session: Session
  ): Promise<CommentThreadListOutput> {
    const perms = await this.authorizationService.getPermissions({
      resource: parentType,
      sessionOrUserId: session,
      dto: parent,
    });

    if (!perms.commentThreads.canRead) {
      return SecuredList.Redacted;
    }

    const results = await this.commentThreadRepo.list(input, session);

    return {
      ...(await mapListResults(results, (dto) =>
        this.readOneThread(dto.id, session)
      )),
    };
  }

  async listCommentsByThreadId(input: CommentListInput, session: Session) {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
