import { Injectable } from '@nestjs/common';
import { isAdmin } from '~/common/session';
import {
  ID,
  InputException,
  isIdLike,
  NotFoundException,
  Resource,
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
import { CommentRepository } from './comment.repository';
import {
  Comment,
  Commentable,
  CommentListInput,
  CommentThreadListInput,
  CommentThreadListOutput,
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
      this.logger.warning('Failed to create comment', {
        exception,
      });

      if (
        input.threadId &&
        !(await this.repo.threads.getBaseNode(input.threadId))
      ) {
        throw new InputException('Comment thread does not exist', 'threadId');
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
      canDelete: dto.creator === session.userId || isAdmin(session),
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
    if (!object.canDelete) {
      throw new UnauthorizedException(
        'You do not have permission to delete this comment'
      );
    }

    const commentList = await this.listCommentsByThreadId(
      object.thread,
      CommentListInput.defaultVal,
      session
    );

    if (commentList.total === 1) {
      await this.repo.threads.deleteNode(object.thread);
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

  async readOneThread(id: ID, session: Session) {
    const dto = await this.repo.threads.readOne(id);

    return {
      ...dto,
      canDelete: await this.repo.threads.checkDeletePermission(dto.id, session),
    };
  }

  async readManyThreads(ids: readonly ID[]) {
    return await this.repo.threads.readMany(ids);
  }

  async listThreads(
    parent: Commentable,
    input: CommentThreadListInput,
    session: Session
  ): Promise<CommentThreadListOutput> {
    const perms = await this.getPermissionsFromResource(parent, session);
    if (!perms?.canRead) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.threads.list(parent.id, input, session);

    return {
      ...(await mapListResults(results, (dto) =>
        this.readOneThread(dto.id, session)
      )),
    };
  }

  async listCommentsByThreadId(
    thread: ID,
    input: CommentListInput,
    session: Session
  ) {
    const results = await this.repo.list(thread, input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
