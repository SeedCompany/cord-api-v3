import { Injectable } from '@nestjs/common';
import { difference } from 'lodash';
import {
  CreationFailed,
  type ID,
  InvalidIdForTypeException,
  isIdLike,
  NotFoundException,
  Resource,
  SecuredList,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ResourceLoader, ResourcesHost } from '~/core';
import { Identity } from '~/core/authentication';
import { type BaseNode, isBaseNode } from '~/core/database/results';
import { Privileges } from '../authorization';
import { CommentRepository } from './comment.repository';
import {
  Comment,
  Commentable,
  type CommentList,
  type CommentListInput,
  type CommentThread,
  type CommentThreadList,
  type CommentThreadListInput,
  type CreateCommentInput,
  type UpdateCommentInput,
} from './dto';
import { CommentViaMentionNotificationService } from './mention-notification/comment-via-mention-notification.service';

type CommentableRef = ID | BaseNode | Commentable;

@Injectable()
export class CommentService {
  constructor(
    private readonly repo: CommentRepository,
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
    private readonly resourcesHost: ResourcesHost,
    private readonly identity: Identity,
    private readonly mentionNotificationService: CommentViaMentionNotificationService,
  ) {}

  async create(input: CreateCommentInput) {
    const perms = await this.getPermissionsFromResource(input.resourceId);
    perms.verifyCan('create');

    let dto;
    try {
      const result = await this.repo.create(input);
      if (!result) {
        throw new CreationFailed(Comment);
      }
      dto = await this.repo.readOne(result.id);
    } catch (exception) {
      if (
        input.threadId &&
        !(await this.repo.threads.getBaseNode(input.threadId))
      ) {
        throw new NotFoundException(
          'Comment thread does not exist',
          'threadId',
        );
      }

      throw new CreationFailed(Comment, { cause: exception });
    }

    const mentionees = this.mentionNotificationService.extract(dto);
    await this.mentionNotificationService.notify(mentionees, dto);

    return this.secureComment(dto);
  }

  async getPermissionsFromResource(resource: CommentableRef) {
    const parent = await this.loadCommentable(resource);
    const parentType = this.resourcesHost.getByName(
      // I'd like to type this prop as this but somehow blows everything up.
      parent.__typename as 'Commentable',
    );
    return this.privileges.for(parentType, parent).forEdge('commentThreads');
  }

  async verifyCanView(resource: CommentableRef) {
    const perms = await this.getPermissionsFromResource(resource);
    perms.verifyCan('read');
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

    try {
      this.resourcesHost.verifyImplements(parent.__typename, Commentable);
    } catch (e) {
      throw new NonCommentableType(e.message);
    }
    return parent as Commentable;
  }

  async readOne(id: ID): Promise<Comment> {
    const dto = await this.repo.readOne(id);
    return this.secureComment(dto);
  }

  async readMany(ids: readonly ID[]) {
    const comments = await this.repo.readMany(ids);
    return comments.map((dto) => this.secureComment(dto));
  }

  secureThread(thread: UnsecuredDto<CommentThread>): CommentThread {
    return {
      ...thread,
      firstComment: this.secureComment(thread.firstComment),
      latestComment: this.secureComment(thread.latestComment),
      canDelete: this.identity.isSelf(thread.creator) || this.identity.isAdmin,
    };
  }

  secureComment(dto: UnsecuredDto<Comment>): Comment {
    return this.privileges.for(Comment).secure(dto);
  }

  async update(input: UpdateCommentInput): Promise<Comment> {
    const object = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(Comment, object).verifyChanges(changes);
    await this.repo.update(object, changes);

    const updated = await this.repo.readOne(object.id);

    const prevMentionees = this.mentionNotificationService.extract(object);
    const nowMentionees = this.mentionNotificationService.extract(updated);
    const newMentionees = difference(prevMentionees, nowMentionees);
    await this.mentionNotificationService.notify(newMentionees, updated);

    return this.secureComment(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOne(id);
    this.privileges.for(Comment, object).verifyCan('delete');

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

  async getThreadCount(parent: Commentable) {
    const perms = await this.getPermissionsFromResource(parent);

    // Do check here since we don't filter in the db query.
    // Will need to be updated with DB switch.
    if (!perms.can('read')) {
      return 0;
    }

    return await this.repo.threads.count(parent.id);
  }

  async listThreads(
    parent: Commentable,
    input: CommentThreadListInput,
  ): Promise<CommentThreadList> {
    const perms = await this.getPermissionsFromResource(parent);

    // Do check here since we don't filter in the db query.
    // Will need to be updated with DB switch.
    if (!perms.can('read')) {
      return { ...SecuredList.Redacted, parent };
    }

    const results = await this.repo.threads.list(parent.id, input);

    return {
      ...results,
      items: results.items.map((dto) => this.secureThread(dto)),
      parent,
      canRead: true,
      canCreate: perms.can('create'),
    };
  }

  async listCommentsByThreadId(
    thread: CommentThread,
    input: CommentListInput,
  ): Promise<CommentList> {
    const perms = await this.getPermissionsFromResource(thread.parent);

    // Do check here since we don't filter in the db query.
    // Will need to be updated with DB switch.
    if (!perms.can('read')) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.list(thread.id, input);

    return {
      ...results,
      items: results.items.map((dto) => this.secureComment(dto)),
      canRead: true,
      canCreate: perms.can('create'),
    };
  }
}

class NonCommentableType extends InvalidIdForTypeException {}
