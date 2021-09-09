import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
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
import { mapListResults } from '../../core/database/results';
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

  async create(input: CreatePost, session: Session): Promise<Post> {
    if (!input.parentId) {
      throw new ServerException(
        'A post must be associated with a parent node.'
      );
    }

    try {
      const result = await this.repo.create(input, session);
      if (!result) {
        throw new ServerException('Failed to create post');
      }

      // FIXME: This is being refactored - leaving it commented out per Michael's instructions for now
      // await this.authorizationService.processNewBaseNode(
      //   new DbPost(),
      //   postId,
      //   session.userId
      // );

      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.warning('Failed to create post', {
        exception,
      });

      if (!(await this.repo.checkParentIdValidity(input.parentId))) {
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
    parent: Postable & Resource,
    input: PostListInput,
    session: Session
  ): Promise<SecuredPostList> {
    const perms = await this.authorizationService.getPermissions({
      resource: parentType,
      sessionOrUserId: session,
      dto: parent,
    });
    if (!perms.posts.canRead) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.securedList(input, session);

    return {
      ...(await mapListResults(results, (id) => this.readOne(id, session))),
      canRead: true, // false handled above
      canCreate: perms.posts.canEdit,
    };
  }
}
