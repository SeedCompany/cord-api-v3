import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  EnhancedResource,
  ID,
  InputException,
  NotFoundException,
  Resource,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { CreatePost, Post, Postable, UpdatePost } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

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
    // TODO: need to check if have a CreatePost power.
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

  private async secure(
    dto: UnsecuredDto<Post>,
    session: Session
  ): Promise<Post> {
    const securedProps = await this.authorizationService.secureProperties(
      Post,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
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
    parentType: EnhancedResource<any>,
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
      ...(await mapListResults(results, (dto) => this.secure(dto, session))),
      canRead: true, // false handled above
      canCreate: perms.posts.canEdit,
    };
  }
}
