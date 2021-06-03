import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  InputException,
  NotFoundException,
  Resource,
  ResourceShape,
  SecuredList,
  ServerException,
  Session,
} from '../../common';
import { ILogger, Logger } from '../../core';
import { runListQuery } from '../../core/database/results';
import { ScopedRole } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { CreatePost, Post, UpdatePost } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';
import { Postable } from './postable/dto/postable.dto';

@Injectable()
export class PostService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: PostRepository,
    @Logger('post:service') private readonly logger: ILogger
  ) {}

  async create(
    { parentId, ...input }: CreatePost,
    session: Session
  ): Promise<Post> {
    const createdAt = DateTime.local();
    const postId = await generateId();

    const secureProps = [
      {
        key: 'creator',
        value: session.userId,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'type',
        value: input.type,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'shareability',
        value: input.shareability,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'body',
        value: input.body,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'modifiedAt',
        value: createdAt,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    if (!parentId) {
      throw new ServerException(
        'A post must be associated with a parent node.'
      );
    }

    try {
      await this.repo.create(parentId, postId, secureProps, session);

      // FIXME: This is being refactored - leaving it commented out per Michael's instructions for now
      // await this.authorizationService.processNewBaseNode(
      //   new DbPost(),
      //   postId,
      //   session.userId
      // );

      return await this.readOne(postId, session);
    } catch (exception) {
      this.logger.warning('Failed to create post', {
        exception,
      });

      if (!(await this.repo.checkParentIdValidity(parentId))) {
        throw new InputException('parentId is invalid', 'post.parentId');
      }

      throw new ServerException('Failed to create post', exception);
    }
  }

  async readOne(postId: ID, session: Session): Promise<Post> {
    const result = await this.repo.readOne(postId);

    const securedProps = await this.authorizationService.secureProperties(
      Post,
      result,
      session
    );

    return {
      ...result,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(postId, session),
    };
  }

  async update(input: UpdatePost, session: Session): Promise<Post> {
    const object = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(object, input);
    await this.repo.updateProperties(object, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find post', 'post.id');
    }

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete post', {
        exception,
      });

      throw new ServerException('Failed to delete post', exception);
    }
  }

  async securedList(
    parentType: ResourceShape<Postable>,
    parent: Postable & Resource & { scope?: ScopedRole[] },
    { filter, ...input }: PostListInput,
    session: Session
  ): Promise<SecuredPostList> {
    const perms = await this.authorizationService.getPermissions(
      parentType,
      session,
      parent.scope
    );
    if (!perms.posts.canRead) {
      return SecuredList.Redacted;
    }

    const query = this.repo.securedList({ filter, ...input });

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true, // false handled above
      canCreate: perms.posts.canEdit,
    };
  }
}
