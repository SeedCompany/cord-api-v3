import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ILogger, Logger, ResourceLoader, ResourcesHost } from '~/core';
import { BaseNode, isBaseNode, mapListResults } from '~/core/database/results';
import {
  EnhancedResource,
  ID,
  InputException,
  InvalidIdForTypeException,
  isIdLike,
  NotFoundException,
  Resource,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Privileges } from '../authorization';
import { UserService } from '../user';
import { CreatePost, Post, Postable, UpdatePost } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

type CommentableRef = ID | BaseNode | Postable;

@Injectable()
export class PostService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly privileges: Privileges,
    private readonly repo: PostRepository,
    private readonly resources: ResourceLoader,
    private readonly resourcesHost: ResourcesHost,
    @Logger('post:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreatePost, session: Session): Promise<Post> {
    if (!input.parentId) {
      throw new ServerException(
        'A post must be associated with a parent node.',
      );
    }
    const perms = await this.getPermissionsFromResource(
      input.parentId,
      session,
    );
    perms.verifyCan('create');

    try {
      const result = await this.repo.create(input, session);
      if (!result) {
        throw new ServerException('Failed to create post');
      }

      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.warning('Failed to create post', {
        exception,
      });

      if (!(await this.repo.getBaseNode(input.parentId, 'BaseNode'))) {
        throw new InputException('parentId is invalid', 'post.parentId');
      }

      throw new ServerException('Failed to create post', exception);
    }
  }

  async readOne(postId: ID, session: Session): Promise<Post> {
    const dto = await this.repo.readOne(postId);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const posts = await this.repo.readMany(ids);
    return await Promise.all(posts.map((dto) => this.secure(dto, session)));
  }

  async loadPostable(resource: CommentableRef): Promise<Postable> {
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
      await this.resourcesHost.verifyImplements(parent.__typename, Postable);
    } catch (e) {
      throw new NonPostableType(e.message);
    }
    return parent as Postable;
  }

  private async secure(
    dto: UnsecuredDto<Post>,
    session: Session,
  ): Promise<Post> {
    return this.privileges.for(session, Post).secure(dto);
  }

  async getPermissionsFromResource(resource: CommentableRef, session: Session) {
    const parent = await this.loadPostable(resource);
    const parentType = await this.resourcesHost.getByName(
      parent.__typename as 'Postable',
    );
    return this.privileges.for(session, parentType, parent).forEdge('posts');
  }

  async update(input: UpdatePost, session: Session): Promise<Post> {
    const object = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(session, Post, object).verifyChanges(changes);
    await this.repo.updateProperties(object, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    this.privileges.for(session, Post, object).verifyCan('delete');

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
    parentType: EnhancedResource<typeof Postable>,
    parent: Postable & Resource,
    input: PostListInput,
    session: Session,
  ): Promise<SecuredPostList> {
    const perms = this.privileges.for(session, parentType, parent).all;

    if (!perms.posts.read) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.securedList(input, session);

    return {
      ...(await mapListResults(results, (dto) => this.secure(dto, session))),
      canRead: true, // false handled above
      canCreate: perms.posts.create,
    };
  }
}

class NonPostableType extends InvalidIdForTypeException {}
