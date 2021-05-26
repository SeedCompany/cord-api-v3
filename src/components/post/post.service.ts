import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from 'aws-sdk';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import { ILogger, Logger } from '../../core';
import {
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { UserService } from '../user';
import { CreatePost, Post, UpdatePost } from './dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

@Injectable()
export class PostService {
  private readonly securedProperties = {
    body: true,
    user: true,
    modifiedAt: true,
  };

  constructor(
    private readonly config: ConfigService,
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
    const result = await this.repo.readOne(postId, session);

    if (!result) {
      throw new NotFoundException('Could not find post', 'post.id');
    }

    const props = parsePropList(result.propList);
    const securedProps = await this.authorizationService.secureProperties(
      Post,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      type: props.type,
      shareability: props.shareability,
      body: {
        value: props.body,
        canRead: true,
        canEdit: true,
      },
      creator: {
        value: props.creator,
        canRead: true,
        canEdit: true,
      },
      modifiedAt: props.modifiedAt,
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
    { filter, ...input }: PostListInput,
    session: Session
  ): Promise<SecuredPostList> {
    // const query = this.db
    //   .query()
    //   .match([requestingUser(session), ...permissionsOfNode(label)])
    //   .call(calculateTotalAndPaginateList(Post, input));
    const query = this.repo.securedList({ filter, ...input });

    return {
      ...(await runListQuery(query, input, (id) => this.readOne(id, session))),
      canRead: true, // FIXME: implement permissioning
      canCreate: true, // FIXME: implement permissioning
    };
  }
}
