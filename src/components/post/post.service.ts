import { Injectable } from '@nestjs/common';
import { ILogger, Logger, ResourceLoader, ResourcesHost } from '~/core';
import { BaseNode, isBaseNode } from '~/core/database/results';
import {
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
import { CreatePost, Post, Postable, UpdatePost } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

type PostableRef = ID | BaseNode | Postable;

@Injectable()
export class PostService {
  constructor(
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
    const perms = await this.getPermissionsFromPostable(
      input.parentId,
      session,
    );
    perms.verifyCan('create');

    try {
      const result = await this.repo.create(input, session);
      if (!result) {
        throw new ServerException('Failed to create post');
      }

      return this.secure(result.dto, session);
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

  async update(input: UpdatePost, session: Session): Promise<Post> {
    const object = await this.repo.readOne(input.id, session);

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(session, Post, object).verifyChanges(changes);
    const updated = await this.repo.updateProperties(object, changes);

    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.repo.readOne(id, session);

    const perms = await this.getPermissionsFromPostable(
      object.parent.properties.id,
      session,
    );
    perms.verifyCan('delete');

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
    parent: Postable & Resource,
    input: PostListInput,
    session: Session,
  ): Promise<SecuredPostList> {
    const perms = await this.getPermissionsFromPostable(parent, session);

    if (!perms.can('read')) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.securedList(input, session);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
      canRead: true, // false handled above
      canCreate: perms.can('create'),
    };
  }

  secure(dto: UnsecuredDto<Post>, session: Session) {
    return this.privileges.for(session, Post).secure(dto);
  }

  async getPermissionsFromPostable(resource: PostableRef, session: Session) {
    const parent = await this.loadPostable(resource);
    const parentType = await this.resourcesHost.getByName(
      parent.__typename as 'Postable',
    );
    return this.privileges.for(session, parentType, parent).forEdge('posts');
  }

  private async loadPostable(resource: PostableRef): Promise<Postable> {
    const parentNode = isIdLike(resource)
      ? await this.repo.getBaseNode(resource, Resource)
      : resource;
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'resourceId');
    }
    const parent = isBaseNode(parentNode)
      ? ((await this.resources.loadByBaseNode(parentNode)) as Postable)
      : parentNode;

    try {
      await this.resourcesHost.verifyImplements(parent.__typename, Postable);
    } catch (e) {
      throw new NonPostableType(e.message);
    }
    return parent;
  }
}

class NonPostableType extends InvalidIdForTypeException {}
