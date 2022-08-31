import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  isIdLike,
  NotFoundException,
  Order,
  Resource,
  ResourceShape,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { ILogger, Logger, ResourceLoader } from '../../core';
import {
  BaseNode,
  isBaseNode,
  mapListResults,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { resourceFromName } from '../authorization/model/resource-map';
import { CommentThreadRepository } from './comment-thread.repository';
import { CommentRepository } from './comment.repository';
import {
  Comment,
  Commentable,
  CommentListInput,
  CommentThreadListInput,
  CommentThreadListOutput,
  CreateCommentInput,
  CreateCommentThreadInput,
} from './dto';
import { UpdateCommentInput } from './dto/update-comment.dto';

type CommentableRef = ID | BaseNode | Commentable;

@Injectable()
export class CommentService {
  constructor(
    private readonly repo: CommentRepository,
    private readonly commentThreadRepo: CommentThreadRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly resources: ResourceLoader,
    @Logger('comment:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateCommentInput, session: Session) {
    if (!input.threadId) {
      throw new ServerException('A comment must be associated with a thread');
    }

    const perms = await this.getPermissionsFromResource(
      input.resourceId,
      session
    );
    if (!perms?.canEdit) {
      throw new UnauthorizedException(
        'You do not have the permission to add comments to this resource'
      );
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

  async getPermissionsFromResource(resource: CommentableRef, session: Session) {
    const parent = await this.loadCommentable(resource);
    const { commentThreads: perms } =
      await this.authorizationService.getPermissions<typeof Commentable>({
        // @ts-expect-error We are assuming this is an implementation of Commentable
        resource: resourceFromName(parent.__typename),
        dto: parent,
        sessionOrUserId: session,
      });
    // this can be null on dev error
    if (!perms) {
      this.logger.warning(
        `${parent.__typename} does not have any \`commentThreads\` permissions defined`
      );
    }
    return perms as typeof perms | null;
  }

  async loadCommentable(resource: CommentableRef): Promise<Commentable> {
    const parentNode = isIdLike(resource)
      ? await this.repo.getBaseNode(resource, Resource)
      : resource;
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'resourceId');
    }
    const parent = isBaseNode(parentNode)
      ? await this.resources.loadByBaseNode(parentNode)
      : parentNode;
    return parent as Commentable;
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

  async update(input: UpdateCommentInput, session: Session): Promise<Comment> {
    const object = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(object, input);
    await this.repo.updateProperties(object, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    const commentThreadId = await this.repo.getThreadId(id);

    const commentList = await this.listCommentsByThreadId(
      {
        count: 10,
        sort: 'createdAt',
        order: Order.ASC,
        page: 1,
        filter: { threadId: commentThreadId!.threadId },
      },
      session
    );

    if (commentList.total === 1) {
      await this.commentThreadRepo.deleteNode(commentThreadId!.threadId);
    }

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

  async createThread(input: CreateCommentThreadInput, session: Session) {
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

    return {
      ...dto,
      canDelete: await this.commentThreadRepo.checkDeletePermission(
        dto.id,
        session
      ),
    };
  }

  async readManyThreads(ids: readonly ID[]) {
    return await this.commentThreadRepo.readMany(ids);
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
