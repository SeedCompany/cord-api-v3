import { Injectable } from '@nestjs/common';
import {
  ID,
  isIdLike,
  NotFoundException,
  Resource,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { isAdmin } from '~/common/session';
import { ILogger, Logger, ResourceLoader, ResourcesHost } from '~/core';
import { BaseNode, isBaseNode, mapListResults } from '~/core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { CommentRepository } from './comment.repository';
import {
  Comment,
  Commentable,
  CommentListInput,
  CommentThread,
  CommentThreadList,
  CommentThreadListInput,
  CreateCommentInput,
} from './dto';
import { UpdateCommentInput } from './dto/update-comment.dto';

type CommentableRef = ID | BaseNode | Commentable;

@Injectable()
export class CommentService {
  constructor(
    private readonly repo: CommentRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly resources: ResourceLoader,
    private readonly resourcesHost: ResourcesHost,
    @Logger('comment:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateCommentInput, session: Session) {
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
      if (
        input.threadId &&
        !(await this.repo.threads.getBaseNode(input.threadId))
      ) {
        throw new NotFoundException(
          'Comment thread does not exist',
          'threadId'
        );
      }

      throw new ServerException('Failed to create comment', exception);
    }
  }

  async getPermissionsFromResource(resource: CommentableRef, session: Session) {
    const parent = await this.loadCommentable(resource);
    const parentType = await this.resourcesHost.getByName(
      // I'd like to type this prop as this but somehow blows everything up.
      parent.__typename as 'Commentable'
    );
    const { commentThreads: perms } =
      await this.authorizationService.getPermissions<typeof Commentable>({
        resource: parentType,
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

  async verifyCanView(resource: CommentableRef, session: Session) {
    const perms = await this.getPermissionsFromResource(resource, session);
    if (!perms?.canRead) {
      throw new UnauthorizedException(
        'You do not have the permission to view this comment thread'
      );
    }
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
    return await this.secureComment(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const comments = await this.repo.readMany(ids);
    return await Promise.all(
      comments.map((dto) => this.secureComment(dto, session))
    );
  }

  async secureThread(
    thread: UnsecuredDto<CommentThread>,
    session: Session
  ): Promise<CommentThread> {
    return {
      ...thread,
      firstComment: await this.secureComment(thread.firstComment, session),
      latestComment: await this.secureComment(thread.latestComment, session),
      canDelete: thread.creator === session.userId || isAdmin(session),
    };
  }

  async secureComment(
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
      canDelete: dto.creator === session.userId || isAdmin(session),
    };
  }

  async update(input: UpdateCommentInput, session: Session): Promise<Comment> {
    const object = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      Comment,
      object,
      changes
    );
    await this.repo.updateProperties(object, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    if (!object.canDelete) {
      throw new UnauthorizedException(
        'You do not have permission to delete this comment'
      );
    }

    const thread = await this.repo.threads.readOne(object.thread);
    if (object.id === thread.firstComment.id) {
      await this.repo.threads.deleteNode(object.thread);
    }

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete comment', exception);
    }
  }

  async listThreads(
    parent: Commentable,
    input: CommentThreadListInput,
    session: Session
  ): Promise<CommentThreadList> {
    await this.verifyCanView(parent, session);

    const results = await this.repo.threads.list(parent.id, input, session);

    return {
      ...(await mapListResults(results, (dto) =>
        this.secureThread(dto, session)
      )),
      parent,
    };
  }

  async listCommentsByThreadId(
    thread: ID,
    input: CommentListInput,
    session: Session
  ) {
    const results = await this.repo.list(thread, input, session);
    return await mapListResults(results, (dto) =>
      this.secureComment(dto, session)
    );
  }
}
