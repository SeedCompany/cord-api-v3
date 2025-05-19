import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  type ID,
  InputException,
  InvalidIdForTypeException,
  isIdLike,
  NotFoundException,
  Resource,
  SecuredList,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ILogger, Logger, ResourceLoader, ResourcesHost } from '~/core';
import { Identity } from '~/core/authentication';
import { type BaseNode, isBaseNode } from '~/core/database/results';
import { Privileges } from '../authorization';
import { type CreatePost, Post, Postable, type UpdatePost } from './dto';
import { type PostListInput, type SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

type ConcretePostable = Postable & { __typename: string };
type PostableRef = ID | BaseNode | ConcretePostable;

@Injectable()
export class PostService {
  constructor(
    private readonly identity: Identity,
    private readonly privileges: Privileges,
    private readonly repo: PostRepository,
    private readonly resources: ResourceLoader,
    private readonly resourcesHost: ResourcesHost,
    @Logger('post:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreatePost): Promise<Post> {
    if (!input.parentId) {
      throw new ServerException(
        'A post must be associated with a parent node.',
      );
    }
    const perms = await this.getPermissionsFromPostable(input.parentId);
    perms.verifyCan('create');

    try {
      const result = await this.repo.create(input);
      if (!result) {
        throw new CreationFailed(Post);
      }

      return this.secure(result.dto);
    } catch (exception) {
      this.logger.warning('Failed to create post', {
        exception,
      });

      if (!(await this.repo.getBaseNode(input.parentId, 'BaseNode'))) {
        throw new InputException('parentId is invalid', 'post.parentId');
      }

      throw new CreationFailed(Post, { cause: exception });
    }
  }

  async update(input: UpdatePost): Promise<Post> {
    const object = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(Post, object).verifyChanges(changes);
    const updated = await this.repo.update(object, changes);

    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOne(id);

    this.privileges.for(Post, object).verifyCan('delete');

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
    parent: ConcretePostable & Resource,
    input: PostListInput,
  ): Promise<SecuredPostList> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return SecuredList.Redacted;
    }

    const perms = await this.getPermissionsFromPostable(parent);

    if (!perms.can('read')) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.securedList(input);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
      canRead: true, // false handled above
      canCreate: perms.can('create'),
    };
  }

  secure(dto: UnsecuredDto<Post>) {
    return this.privileges.for(Post).secure(dto);
  }

  async getPermissionsFromPostable(resource: PostableRef) {
    const parent = await this.loadPostable(resource);
    const parentType = this.resourcesHost.getByName(
      parent.__typename as 'Postable',
    );
    return this.privileges.for(parentType, parent).forEdge('posts');
  }

  private async loadPostable(resource: PostableRef): Promise<ConcretePostable> {
    const parentNode = isIdLike(resource)
      ? await this.repo.getBaseNode(resource, Resource)
      : resource;
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'resourceId');
    }
    const parent = isBaseNode(parentNode)
      ? ((await this.resources.loadByBaseNode(parentNode)) as ConcretePostable)
      : parentNode;

    try {
      this.resourcesHost.verifyImplements(parent.__typename, Postable);
    } catch (e) {
      throw new NonPostableType(e.message);
    }
    return parent;
  }
}

class NonPostableType extends InvalidIdForTypeException {}
